const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeGame } = require('../src/lib/game');
const { maxCoinsForFloor, maxFloorForDuration, CONTINUE_PRICE, STARTING_COINS } = require('../src/config/game');

test('makul oyun olduğu gibi kabul edilir', () => {
  assert.deepEqual(sanitizeGame({ floor: 40, coinsCollected: 30, durationMs: 60_000 }), { floor: 40, coins: 30 });
});

test('süreye göre imkânsız kat kırpılır', () => {
  const r = sanitizeGame({ floor: 5000, coinsCollected: 0, durationMs: 10_000 });
  assert.equal(r.floor, maxFloorForDuration(10_000));
});

test('kata göre fazla coin kırpılır', () => {
  const r = sanitizeGame({ floor: 10, coinsCollected: 999, durationMs: 60_000 });
  assert.equal(r.coins, maxCoinsForFloor(10));
});

test('ekonomi sabitleri uygulamayla aynı', () => {
  assert.equal(CONTINUE_PRICE, 50);
  assert.equal(STARTING_COINS, 100);
});
