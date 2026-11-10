// RevenueCat olay/cevap ayrıştırma (saf, DB'siz). Kredi/iade kararı burada verilir.
const { findCoinPackByProductId } = require('../config/catalog');

const CREDIT_EVENT_TYPES = new Set(['NON_RENEWING_PURCHASE', 'INITIAL_PURCHASE']);
// RevenueCat iadeleri çoğunlukla CANCELLATION (cancel_reason=CUSTOMER_SUPPORT) olarak gönderir; REFUND da kabul edilir.
const REVERSE_EVENT_TYPES = new Set(['CANCELLATION', 'REFUND']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

function str(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Olaydaki tüm kullanıcı kimlikleri (app_user_id, original_app_user_id, aliases, transferred_to); yalnız UUID olanlar. */
function candidateUserIds(event) {
  const ids = [event.app_user_id, event.original_app_user_id]
    .concat(Array.isArray(event.aliases) ? event.aliases : [])
    .concat(Array.isArray(event.transferred_to) ? event.transferred_to : []);
  return [...new Set(ids.filter(isUuid).map((s) => s.toLowerCase()))];
}

/**
 * Webhook gövdesi → karar.
 * @returns {{ action: 'credit'|'reverse'|'ignore', reason?, type, eventId, transactionId, productId, pack, userIds, environment }}
 */
function parseWebhookEvent(body) {
  const event = body && typeof body === 'object' ? body.event : null;
  if (!event || typeof event !== 'object') {
    return { action: 'ignore', reason: 'no_event', type: null, eventId: null, transactionId: null, productId: null, pack: null, userIds: [], environment: null };
  }
  const type = str(event.type);
  const productId = str(event.product_id);
  const pack = findCoinPackByProductId(productId);
  // Ortak anahtar: mağaza işlem id'si (REST API'deki store_transaction_id ile aynı). Yoksa olay id'si.
  const transactionId = str(event.transaction_id) || str(event.id);
  const base = {
    type,
    eventId: str(event.id),
    transactionId,
    productId,
    pack,
    userIds: candidateUserIds(event),
    environment: str(event.environment),
  };

  if (!type) return { action: 'ignore', reason: 'no_type', ...base };
  const isCredit = CREDIT_EVENT_TYPES.has(type);
  const isReverse = REVERSE_EVENT_TYPES.has(type);
  if (!isCredit && !isReverse) return { action: 'ignore', reason: 'unhandled_type', ...base };
  if (!pack) return { action: 'ignore', reason: 'not_coin_pack', ...base };
  if (!transactionId) return { action: 'ignore', reason: 'no_transaction_id', ...base };
  if (base.userIds.length === 0) return { action: 'ignore', reason: 'no_app_user_id', ...base };
  return { action: isCredit ? 'credit' : 'reverse', ...base };
}

/**
 * GET /v1/subscribers/{id} cevabı → yüklenebilir coin paketi işlemleri.
 * non_subscriptions: { [product_id]: [{ id, store_transaction_id, is_sandbox, purchase_date, store }] }
 */
function extractSyncPurchases(apiResponse) {
  const nonSubs = apiResponse && apiResponse.subscriber && apiResponse.subscriber.non_subscriptions;
  if (!nonSubs || typeof nonSubs !== 'object') return [];
  const out = [];
  for (const [productId, list] of Object.entries(nonSubs)) {
    const pack = findCoinPackByProductId(productId);
    if (!pack || !Array.isArray(list)) continue;
    for (const p of list) {
      if (!p || typeof p !== 'object') continue;
      const transactionId = str(p.store_transaction_id) || str(p.id);
      if (!transactionId) continue;
      out.push({
        transactionId,
        rcTransactionId: str(p.id),
        productId,
        pack,
        environment: p.is_sandbox ? 'SANDBOX' : 'PRODUCTION',
        raw: p,
      });
    }
  }
  return out;
}

/** Bakiye negatife düşmez: geri alınacak miktar min(yüklenen, mevcut bakiye). */
function refundDeduction(creditedCoins, currentBalance) {
  return Math.max(0, Math.min(Number(creditedCoins) || 0, Number(currentBalance) || 0));
}

module.exports = {
  CREDIT_EVENT_TYPES,
  REVERSE_EVENT_TYPES,
  isUuid,
  candidateUserIds,
  parseWebhookEvent,
  extractSyncPurchases,
  refundDeduction,
};
