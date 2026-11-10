const { CONTINUE_PRICE } = require('../config/game');
const { ApiError, CODES } = require('../lib/apiError');
const { sanitizeGame } = require('../lib/game');
const { changeCoins, mutateUser, toProgress } = require('./userService');

/**
 * Oyun bitti: rekor, oyun sayısı ve toplanan coin'ler. Değerler süreye ve
 * kata göre makul aralığa kırpılır (games tablosunda bildirilen değer de saklanır).
 */
async function recordGame(userId, { floor, coinsCollected, continuesUsed, durationMs, clientEventId }) {
  return mutateUser(userId, { type: 'game_over', clientEventId }, async (conn, user) => {
    const game = sanitizeGame({ floor, coinsCollected, durationMs });
    await conn.query(
      `INSERT INTO games (user_id, floor, reported_floor, coins_collected, reported_coins, continues_used, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, game.floor, floor, game.coins, coinsCollected, continuesUsed, durationMs],
    );
    if (game.coins > 0) await changeCoins(conn, user, game.coins, 'game_reward', clientEventId);
    const best = Math.max(Number(user.best_floor), game.floor);
    await conn.query('UPDATE users SET best_floor = ?, games_played = games_played + 1 WHERE id = ?', [best, userId]);
    user.best_floor = best;
    user.games_played = Number(user.games_played) + 1;
    return toProgress(user);
  });
}

/** Kırılınca devam: bedelin kayıtlı bakiyeden ödenen kısmı ([amount] <= devam bedeli). */
async function spendForContinue(userId, { amount, clientEventId }) {
  if (amount < 1 || amount > CONTINUE_PRICE) throw ApiError.badRequest('amount out of range');
  return mutateUser(userId, { type: 'continue', clientEventId }, async (conn, user) => {
    if (Number(user.coins) < amount) throw ApiError.conflict(CODES.INSUFFICIENT_COINS);
    await changeCoins(conn, user, -amount, 'continue', clientEventId);
    return toProgress(user);
  });
}

module.exports = { recordGame, spendForContinue };
