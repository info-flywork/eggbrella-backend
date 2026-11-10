// Coin paketleri (consumable). Gerçek para fiyatı burada YOK; uygulama
// RevenueCat / mağazadan gösterir. Öneri: 300 → 0.99, 800 → 1.99, 2000 → 3.99.
// Devam etme 50 coin (config/game.js).
const COIN_PACKS = Object.freeze(
  [
    { id: 'coins_300', product_id: 'com.flywork.eggbrella.coins_300', coins: 300 },
    { id: 'coins_800', product_id: 'com.flywork.eggbrella.coins_800', coins: 800 },
    { id: 'coins_2000', product_id: 'com.flywork.eggbrella.coins_2000', coins: 2000 },
  ].map((p) => Object.freeze(p)),
);

/** RevenueCat / mağaza product id → coin paketi. Store öneki veya Android "...:base" eki tolere edilir. */
function findCoinPackByProductId(productId) {
  if (typeof productId !== 'string' || !productId) return null;
  const candidates = [productId, productId.split(':')[0]];
  return COIN_PACKS.find((p) => candidates.includes(p.product_id)) || null;
}

module.exports = { COIN_PACKS, findCoinPackByProductId };
