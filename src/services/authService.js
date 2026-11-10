const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { STARTING_COINS } = require('../config/game');
const { pool, withTransaction } = require('../db');
const { ApiError } = require('../lib/apiError');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function signAccessToken(userId) {
  return jwt.sign({ typ: 'access' }, env.jwtSecret, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: env.accessTokenTtl,
  });
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  if (payload.typ !== 'access' || typeof payload.sub !== 'string') throw new Error('not an access token');
  return payload;
}

/** Yeni refresh token üretir, DB'ye yalnızca sha256 hash'ini yazar. */
async function issueRefreshToken(conn, userId) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 3600 * 1000);
  const [r] = await conn.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
    userId,
    sha256(token),
    expiresAt,
  ]);
  return { token, id: r.insertId };
}

function publicUser(id) {
  return { id, name: null, email: null, avatar_url: null };
}

/** Cihaz kimliğiyle anonim giriş: yoksa hesap açılır. */
async function loginWithDevice({ deviceId, platform, appVersion }) {
  return withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO users (id, device_id, platform, app_version, coins)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE platform = COALESCE(VALUES(platform), platform),
                               app_version = COALESCE(VALUES(app_version), app_version)`,
      [crypto.randomUUID(), deviceId, platform, appVersion, STARTING_COINS],
    );
    const [[user]] = await conn.query('SELECT id FROM users WHERE device_id = ?', [deviceId]);
    await conn.query(
      'DELETE FROM refresh_tokens WHERE user_id = ? AND (expires_at < NOW(3) OR revoked_at < NOW(3) - INTERVAL 7 DAY)',
      [user.id],
    );
    const refresh = await issueRefreshToken(conn, user.id);
    return {
      access_token: signAccessToken(user.id),
      refresh_token: refresh.token,
      user: publicUser(user.id),
    };
  });
}

/** Rotasyon: eski token iptal edilir, yenisi verilir. Geçersiz / iptal / süresi dolmuş → 401. */
async function refresh(refreshToken) {
  return withTransaction(async (conn) => {
    const [[row]] = await conn.query('SELECT * FROM refresh_tokens WHERE token_hash = ? FOR UPDATE', [
      sha256(refreshToken),
    ]);
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) {
      throw ApiError.unauthorized('invalid refresh token');
    }
    const next = await issueRefreshToken(conn, row.user_id);
    await conn.query('UPDATE refresh_tokens SET revoked_at = NOW(3), replaced_by_id = ? WHERE id = ?', [next.id, row.id]);
    return { access_token: signAccessToken(row.user_id), refresh_token: next.token };
  });
}

async function userExists(userId) {
  const [[row]] = await pool.query('SELECT 1 AS ok FROM users WHERE id = ? AND deleted_at IS NULL', [userId]);
  return Boolean(row);
}

module.exports = { sha256, signAccessToken, verifyAccessToken, loginWithDevice, refresh, userExists };
