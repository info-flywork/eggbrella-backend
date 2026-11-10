// Kullanıcı satırı kilitleme, progress şekli, coin defteri ve istemci olayı idempotentliği.
const { pool, withTransaction } = require('../db');
const { CONTINUE_PRICE } = require('../config/game');
const { ApiError } = require('../lib/apiError');

/** Uygulamadaki PlayerProgress ile aynı şekil. */
function toProgress(user) {
  return {
    coins: Number(user.coins),
    best_floor: Number(user.best_floor),
    games_played: Number(user.games_played),
    continue_price: CONTINUE_PRICE,
  };
}

/** Kullanıcıyı SELECT ... FOR UPDATE ile kilitler (transaction içinde çağrılmalı). */
async function lockUser(conn, userId) {
  const [[user]] = await conn.query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [userId]);
  if (!user) throw ApiError.unauthorized('user not found');
  return user;
}

async function getProgress(userId) {
  const [[user]] = await pool.query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [userId]);
  if (!user) throw ApiError.unauthorized('user not found');
  return toProgress(user);
}

/** Coin değişikliği + defter kaydı. delta negatifse bakiye kontrolü çağırandadır. Yeni bakiyeyi döner. */
async function changeCoins(conn, user, delta, reason, ref = null) {
  const balanceAfter = Number(user.coins) + delta;
  if (balanceAfter < 0) throw new Error('coin balance would go negative');
  if (delta !== 0) {
    await conn.query('UPDATE users SET coins = ? WHERE id = ?', [balanceAfter, user.id]);
  }
  await conn.query(
    'INSERT INTO coin_ledger (user_id, delta, balance_after, reason, ref) VALUES (?, ?, ?, ?, ?)',
    [user.id, delta, balanceAfter, reason, ref],
  );
  user.coins = balanceAfter;
  return balanceAfter;
}

/**
 * Kullanıcıyı kilitleyip fn(conn, user) çalıştırır. clientEventId verilmişse idempotent:
 * aynı (user, client_event_id) daha önce işlendiyse saklanan cevap döner, fn çalışmaz.
 */
async function mutateUser(userId, { type, clientEventId = null }, fn) {
  return withTransaction(async (conn) => {
    const user = await lockUser(conn, userId);
    if (clientEventId) {
      const [[prev]] = await conn.query(
        'SELECT type, response FROM client_events WHERE user_id = ? AND client_event_id = ?',
        [userId, clientEventId],
      );
      if (prev) {
        if (prev.type !== type) throw ApiError.badRequest('client_event_id reused for a different action');
        return JSON.parse(prev.response);
      }
    }
    const result = await fn(conn, user);
    if (clientEventId) {
      await conn.query(
        'INSERT INTO client_events (user_id, client_event_id, type, response) VALUES (?, ?, ?, ?)',
        [userId, clientEventId, type, JSON.stringify(result)],
      );
    }
    return result;
  });
}

module.exports = { toProgress, lockUser, getProgress, changeCoins, mutateUser };
