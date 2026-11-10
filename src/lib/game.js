const { maxCoinsForFloor, maxFloorForDuration } = require('../config/game');

/** İstemcinin bildirdiği oyunu makul sınırlara kırpar. */
function sanitizeGame({ floor, coinsCollected, durationMs }) {
  const safeFloor = Math.min(floor, maxFloorForDuration(durationMs));
  const safeCoins = Math.min(coinsCollected, maxCoinsForFloor(safeFloor));
  return { floor: safeFloor, coins: safeCoins };
}

module.exports = { sanitizeGame };
