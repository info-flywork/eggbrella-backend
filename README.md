# Eggbrella API

Flutter oyunu **Eggbrella** için Node.js REST API.
Express 5 + mysql2 (promise pool) + CommonJS, MariaDB/MySQL. ORM yok, build adımı yok.
Sözleşme: `eggbrella/docs/API_CONTRACT.md` (snake_case alanlar, `{status, message, data}` zarfı).

Uygulama önce cihaza yazar, olayları `client_event_id` ile idempotent gönderir; API coin'de
yetkilidir. Paylaşım klipleri Bunny Storage'a yüklenir, `eggbrella.b-cdn.net` üzerinden sunulur.

## Kurulum

```bash
cp .env.example .env          # DB, JWT_SECRET, BUNNY_* (canlı değerler: .env.production)
npm install
npm run migrate               # migrations/*.sql → schema_migrations
npm start                     # geliştirme: npm run dev
```

- Yerel geliştirmede veritabanı yoksa: `npm run migrate -- --create-db`
- Migration durumu: `npm run migrate:status`
- `JWT_SECRET` üretmek: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- Uzak MySQL'e yerel makineden bağlanmak için cPanel > Remote MySQL'de IP izni gerekir; aksi halde
  `npm run migrate` sunucuda çalıştırılır.

## Testler

```bash
npm test        # node:test — oyun kırpma kuralları, ekonomi sabitleri, mp4 doğrulama
npm run check   # tüm dosyalarda node --check
```

## Yapı

```
src/
  index.js            # giriş (DB ping, listen, graceful shutdown)
  app.js              # express app: cors, json limit, güvenlik başlıkları, morgan→winston, 404, hata zarfı
  db.js               # mysql2/promise havuzu (DB_POOL_LIMIT, varsayılan 5) + withTransaction
  logger.js           # winston (console + logs/combined.log + logs/error.log)
  config/env.js       # .env okuma (yol __dirname'e göre)
  config/game.js      # başlangıç coin'i, devam bedeli, hile sınırları
  routes/ controllers/ services/ middleware/ lib/
migrations/001_init.sql
scripts/migrate.js
test/*.test.js
```

## Uçlar

| Metot | Yol | Kimlik | Dosyalar |
|---|---|---|---|
| GET | `/health` | – | `controllers/healthController.js` |
| POST | `/auth/device` | – | `routes/authRoutes.js` → `controllers/authController.js` → `services/authService.js` |
| POST | `/auth/refresh` | – | aynı (rotasyon; eski token iptal) |
| GET | `/player/progress` | Bearer | `routes/playerRoutes.js` → `controllers/playerController.js` → `services/userService.js` |
| POST | `/player/game-over` | Bearer | → `services/playerService.js` (`client_event_id` ile idempotent) |
| POST | `/player/continue` | Bearer | → `services/playerService.js` (`client_event_id` ile idempotent) |
| DELETE | `/player` | Bearer | → `services/accountService.js` (veri silme + CDN klipleri) |
| POST | `/clips` | Bearer | `routes/clipRoutes.js` → `services/clipService.js` → `services/bunnyClient.js` |

Hata kodları (`message`): `invalid_request` 400, `unauthorized` 401, `not_found` 404,
`insufficient_coins` 409, `too_many_requests` 429, `server_error` 500.

## Tutarlılık kuralları

- Coin değişiklikleri transaction içinde, kullanıcı satırı `SELECT ... FOR UPDATE` ile kilitlenerek yapılır; bakiye negatife düşemez.
- Her coin değişikliği `coin_ledger`'a yazılır (`game_reward`, `continue`).
- `client_events (user_id, client_event_id)` UNIQUE: aynı olay tekrar gelirse ilk cevap döner.
- `game-over`: kat süreye göre (`≤ 5 kat/sn + 5`), coin kata göre (`≤ 2,5 × kat + 8`) kırpılır;
  bildirilen ham değerler `games` tablosunda saklanır.
- `continue`: `amount` (1..50) = devam bedelinin kayıtlı bakiyeden ödenen kısmı; kalanı uygulama
  o oyunda toplanan coin'lerden düşer (o coin'ler `game-over`'da zaten eksik bildirilir).

## Klipler (Bunny CDN)

- `POST /clips` gövdesi ham MP4 (`Content-Type: video/mp4`, en fazla `CLIP_MAX_BYTES`, varsayılan 15 MB).
- `ftyp` kutusu kontrol edilir; kullanıcı başına günde `CLIP_DAILY_LIMIT` (30) klip.
- Yol: `clips/YYYY/MM/<uuid>.mp4` → `https://eggbrella.b-cdn.net/clips/...`
- Storage API: `PUT https://storage.bunnycdn.com/<zone>/<yol>` (`AccessKey` = Storage zone şifresi).

## Deploy (PM2 + nginx)

```bash
npm ci --omit=dev
cp .env.production .env                     # PORT için önce: sudo ss -tlnp
npm run migrate
pm2 startOrReload ecosystem.config.js --update-env && pm2 save
curl https://eggbrella.fly-work.com/health
```

nginx: `proxy_pass http://127.0.0.1:3082;` + `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` başlıkları;
`client_max_body_size 16m;` (klip yükleme) · `sudo nginx -t && sudo systemctl reload nginx`; SSL için `certbot --nginx`.

Geri alma: `pm2 stop eggbrella-api` (diğer süreçlere dokunmaz).
