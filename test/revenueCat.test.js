const test = require('node:test');
const assert = require('node:assert/strict');
const { parseWebhookEvent, extractSyncPurchases, refundDeduction, candidateUserIds } = require('../src/lib/revenueCat');

const USER = '3f0c1b7e-2a4d-4c55-9a1e-6b7f8c9d0e1f';

function ev(overrides) {
  return {
    api_version: '1.0',
    event: {
      id: 'evt-1',
      type: 'NON_RENEWING_PURCHASE',
      app_user_id: USER,
      original_app_user_id: '$RCAnonymousID:abc',
      aliases: ['$RCAnonymousID:abc', USER],
      product_id: 'com.flywork.eggbrella.coins_2000',
      transaction_id: '2000000123',
      environment: 'SANDBOX',
      ...overrides,
    },
  };
}

test('NON_RENEWING_PURCHASE coin paketi → credit', () => {
  const d = parseWebhookEvent(ev());
  assert.equal(d.action, 'credit');
  assert.equal(d.transactionId, '2000000123');
  assert.equal(d.pack.coins, 2000);
  assert.deepEqual(d.userIds, [USER]);
});

test('INITIAL_PURCHASE coin paketi → credit', () => {
  assert.equal(parseWebhookEvent(ev({ type: 'INITIAL_PURCHASE' })).action, 'credit');
});

test('REFUND ve CANCELLATION → reverse', () => {
  assert.equal(parseWebhookEvent(ev({ type: 'REFUND' })).action, 'reverse');
  assert.equal(parseWebhookEvent(ev({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' })).action, 'reverse');
});

test('ignore durumları', () => {
  assert.equal(parseWebhookEvent(ev({ type: 'RENEWAL' })).reason, 'unhandled_type');
  assert.equal(parseWebhookEvent(ev({ type: 'TEST' })).reason, 'unhandled_type');
  assert.equal(parseWebhookEvent(ev({ product_id: 'other.product' })).reason, 'not_coin_pack');
  assert.equal(parseWebhookEvent(ev({ app_user_id: '$RCAnonymousID:x', aliases: [] , original_app_user_id: null })).reason, 'no_app_user_id');
  assert.equal(parseWebhookEvent({}).reason, 'no_event');
  assert.equal(parseWebhookEvent(null).action, 'ignore');
});

test('transaction_id yoksa event.id kullanılır', () => {
  assert.equal(parseWebhookEvent(ev({ transaction_id: null })).transactionId, 'evt-1');
});

test('candidateUserIds: transferred_to ve tekilleştirme', () => {
  const other = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  assert.deepEqual(candidateUserIds({ app_user_id: USER, aliases: [USER.toUpperCase()], transferred_to: [other] }), [USER, other]);
});

test('extractSyncPurchases: yalnız coin paketleri, store_transaction_id anahtarı', () => {
  const resp = {
    subscriber: {
      non_subscriptions: {
        'com.flywork.eggbrella.coins_800': [
          { id: 'rc1', store_transaction_id: 'st1', is_sandbox: true },
          { id: 'rc2', store_transaction_id: null, is_sandbox: false },
        ],
        'some.other.product': [{ id: 'rc3', store_transaction_id: 'st3' }],
      },
    },
  };
  const list = extractSyncPurchases(resp);
  assert.equal(list.length, 2);
  assert.deepEqual(
    list.map((p) => [p.transactionId, p.rcTransactionId, p.pack.coins, p.environment]),
    [
      ['st1', 'rc1', 800, 'SANDBOX'],
      ['rc2', 'rc2', 800, 'PRODUCTION'],
    ],
  );
  assert.deepEqual(extractSyncPurchases({}), []);
  assert.deepEqual(extractSyncPurchases({ subscriber: { non_subscriptions: {} } }), []);
});

test('refundDeduction: bakiye negatife düşmez', () => {
  assert.equal(refundDeduction(1200, 5000), 1200);
  assert.equal(refundDeduction(1200, 300), 300);
  assert.equal(refundDeduction(1200, 0), 0);
  assert.equal(refundDeduction(0, 100), 0);
});
