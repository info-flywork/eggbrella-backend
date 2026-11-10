// RevenueCat webhook (slidify-api'deki yaklaşım; burada coin paketleri için idempotent kredi/iade).
const crypto = require('crypto');
const env = require('../config/env');
const { ApiError } = require('../lib/apiError');
const { success } = require('../lib/response');
const { parseWebhookEvent } = require('../lib/revenueCat');
const purchaseService = require('../services/purchaseService');
const logger = require('../logger');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** RevenueCat panelindeki "Authorization header value" birebir gelir; "Bearer <değer>" biçimi de kabul edilir. */
function isAuthorized(header) {
  const expected = env.revenueCatWebhookAuth;
  if (!expected || !header) return false;
  return safeEqual(header, expected) || safeEqual(header, `Bearer ${expected}`);
}

async function handleWebhook(req, res) {
  if (!isAuthorized(req.get('authorization'))) {
    if (!env.revenueCatWebhookAuth) logger.error('revenuecat.webhook_auth_not_configured');
    throw ApiError.unauthorized('bad webhook auth');
  }

  const decision = parseWebhookEvent(req.body);
  const logMeta = {
    type: decision.type,
    event_id: decision.eventId,
    transaction_id: decision.transactionId,
    product_id: decision.productId,
    environment: decision.environment,
  };

  if (decision.action === 'ignore') {
    logger.info('revenuecat.webhook_ignored', { ...logMeta, reason: decision.reason });
    return success(res, { handled: false, reason: decision.reason });
  }

  const userId = await purchaseService.resolveUserId(decision.userIds);
  if (!userId) {
    // 200 dönülür (RevenueCat tekrar denemesin); işlem kullanıcı /purchases/sync çağırınca yüklenir.
    logger.warn('revenuecat.webhook_unknown_user', { ...logMeta, user_ids: decision.userIds });
    return success(res, { handled: false, reason: 'unknown_user' });
  }

  if (decision.action === 'credit') {
    const r = await purchaseService.creditPurchase({
      userId,
      transactionId: decision.transactionId,
      productId: decision.productId,
      coins: decision.pack.coins,
      source: 'webhook',
      environment: decision.environment,
      raw: req.body.event,
    });
    logger.info('revenuecat.webhook_credit', { ...logMeta, user_id: userId, ...r });
    return success(res, { handled: true, action: 'credit', credited: r.credited, coins: r.coins });
  }

  const r = await purchaseService.reversePurchase({
    transactionId: decision.transactionId,
    userId,
    productId: decision.productId,
    environment: decision.environment,
    raw: req.body.event,
  });
  logger.info('revenuecat.webhook_reverse', { ...logMeta, user_id: userId, ...r });
  return success(res, { handled: true, action: 'reverse', reversed: r.reversed, coins: r.coins });
}

module.exports = { handleWebhook, isAuthorized };
