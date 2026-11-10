// Oyun ekonomisi. Uygulamadaki karşılıkları: PlayerProgress / GameConfig.

/** Yeni oyuncunun başlangıç bakiyesi (uygulama: SharedPrefManager.defaultCoins). */
const STARTING_COINS = 100;

/** Kırılınca devam bedeli (Figma: "Devam et · 50"). */
const CONTINUE_PRICE = 50;

/**
 * Bir oyunda toplanabilecek en fazla coin: sıralar ~1,8 katta bir, sırada en
 * fazla 4 coin + başlangıçtaki 4 coin. Fazlası kırpılır (hile koruması).
 */
function maxCoinsForFloor(floor) {
  return Math.ceil(floor * 2.5) + 8;
}

/**
 * Süreye göre ulaşılabilecek en yüksek kat: en hızlı düşüş ~900 birim/sn,
 * kat 200 birim -> 4,5 kat/sn. Pay bırakılır.
 */
function maxFloorForDuration(durationMs) {
  return Math.floor((durationMs / 1000) * 5) + 5;
}

module.exports = { STARTING_COINS, CONTINUE_PRICE, maxCoinsForFloor, maxFloorForDuration };
