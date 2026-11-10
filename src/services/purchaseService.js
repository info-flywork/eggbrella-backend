// Coin paketi yükleme/iade — webhook ve /purchases/sync aynı fonksiyonları kullanır.
// purchase_transactions.transaction_id UNIQUE olduğu için aynı işlem iki kez yüklenemez.
const { pool, withTransaction } = require('../db');
const { lockUser, changeCoins, getProgress } = require('./userService');
const { extractSyncPurchases, refundDeduction } = require('../lib/revenueCat');
const revenueCatClient = require('./revenueCatClient');
const logger = require('../logger');

function stringify(raw) {
  try {
    return raw === undefined ? null : JSON.stringify(raw);
  } catch (_) {
    return null;
  }
}

/**
 * İdempotent kredi. @returns {{ credited: boolean, coins: number, reason?: string }}
 */
async function creditPurchase({ userId, transactionId, rcTransactionId = null, productId, coins, source, environment = null, raw }) {
  try {
    return await withTransaction(async (conn) => {
      const user = await lockUser(conn, userId); // kilit sırası: önce kullanıcı, sonra işlem
      const [[existing]] = await conn.query(
        'SELECT id, status FROM purchase_transactions WHERE transaction_id = ? FOR UPDATE',
        [transactionId],
      );
      if (existing) return { credited: false, coins: 0, reason: `already_${existing.status}` };

      await conn.query(
        `INSERT INTO purchase_transactions
           (transaction_id, rc_transaction_id, user_id, product_id, coins, source, status, environment, raw)
         VALUES (?, ?, ?, ?, ?, ?, 'credited', ?, ?)`,
        [transactionId, rcTransactionId, userId, productId, coins, source, environment, stringify(raw)],
      );
      await changeCoins(conn, user, coins, 'purchase', transactionId);
      logger.info('purchase.credited', { user_id: userId, transaction_id: transactionId, product_id: productId, coins, source });
      return { credited: true, coins };
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return { credited: false, coins: 0, reason: 'already_credited' };
    throw err;
  }
}

/**
 * İade/iptal: yüklenen coin geri alınır (bakiye 0'ın altına düşmez), kayıt 'refunded' olur.
 * Kayıt yoksa (iade, kredi olayından önce geldiyse) 0 coin'lik 'refunded' kayıt bırakılır; sonraki sync onu yüklemez.
 */
async function reversePurchase({ transactionId, userId, productId, environment = null, raw }) {
  const [[found]] = await pool.query('SELECT user_id FROM purchase_transactions WHERE transaction_id = ?', [transactionId]);
  const ownerId = found ? found.user_id : userId;
  try {
    return await withTransaction(async (conn) => {
      const user = await lockUser(conn, ownerId);
      const [[tx]] = await conn.query('SELECT * FROM purchase_transactions WHERE transaction_id = ? FOR UPDATE', [
        transactionId,
      ]);
      if (!tx) {
        await conn.query(
          `INSERT INTO purchase_transactions
             (transaction_id, user_id, product_id, coins, source, status, environment, raw, refunded_at, refund_raw)
           VALUES (?, ?, ?, 0, 'webhook', 'refunded', ?, NULL, NOW(3), ?)`,
          [transactionId, ownerId, productId, environment, stringify(raw)],
        );
        logger.warn('purchase.refund_before_credit', { user_id: ownerId, transaction_id: transactionId });
        return { reversed: false, coins: 0, reason: 'tombstoned' };
      }
      if (tx.status === 'refunded') return { reversed: false, coins: 0, reason: 'already_refunded' };

      const deduct = refundDeduction(tx.coins, user.coins);
      await changeCoins(conn, user, -deduct, 'purchase_refund', transactionId);
      await conn.query(
        "UPDATE purchase_transactions SET status = 'refunded', refunded_at = NOW(3), refund_raw = ? WHERE id = ?",
        [stringify(raw), tx.id],
      );
      logger.info('purchase.refunded', { user_id: ownerId, transaction_id: transactionId, credited: tx.coins, deducted: deduct });
      return { reversed: true, coins: deduct };
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return { reversed: false, coins: 0, reason: 'race_retry' };
    throw err;
  }
}

/** RevenueCat REST'ten kullanıcının coin paketi işlemlerini okuyup yüklenmemiş olanları yükler. */
async function syncFromRevenueCat(userId) {
  const response = await revenueCatClient.getSubscriber(userId);
  const purchases = extractSyncPurchases(response);
  let creditedCoins = 0;
  for (const p of purchases) {
    const r = await creditPurchase({
      userId,
      transactionId: p.transactionId,
      rcTransactionId: p.rcTransactionId,
      productId: p.productId,
      coins: p.pack.coins,
      source: 'sync',
      environment: p.environment,
      raw: p.raw,
    });
    if (r.credited) creditedCoins += r.coins;
  }
  return { progress: await getProgress(userId), credited_coins: creditedCoins };
}

/** Webhook kararındaki aday id'lerden DB'de var olan ilk kullanıcı. */
async function resolveUserId(candidateIds) {
  if (!candidateIds.length) return null;
  const [rows] = await pool.query('SELECT id FROM users WHERE id IN (?)', [candidateIds]);
  const existing = new Set(rows.map((r) => r.id));
  return candidateIds.find((id) => existing.has(id)) || null;
}

module.exports = { creditPurchase, reversePurchase, syncFromRevenueCat, resolveUserId };
