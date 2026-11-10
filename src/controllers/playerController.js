const playerService = require('../services/playerService');
const accountService = require('../services/accountService');
const { getProgress } = require('../services/userService');
const { success } = require('../lib/response');
const { requireInt, requireString } = require('../lib/validate');

const eventId = (v) => requireString(v, 'client_event_id', { max: 64 });

async function progress(req, res) {
  return success(res, await getProgress(req.userId));
}

async function gameOver(req, res) {
  const body = req.body || {};
  const data = await playerService.recordGame(req.userId, {
    floor: requireInt(body.floor, 'floor', { min: 0, max: 1_000_000 }),
    coinsCollected: requireInt(body.coins_collected, 'coins_collected', { min: 0, max: 1_000_000 }),
    continuesUsed: requireInt(body.continues_used ?? 0, 'continues_used', { min: 0, max: 1000 }),
    durationMs: requireInt(body.duration_ms ?? 0, 'duration_ms', { min: 0, max: 86_400_000 }),
    clientEventId: eventId(body.client_event_id),
  });
  return success(res, data);
}

async function continueGame(req, res) {
  const body = req.body || {};
  const data = await playerService.spendForContinue(req.userId, {
    amount: requireInt(body.amount, 'amount', { min: 1, max: 1_000_000 }),
    clientEventId: eventId(body.client_event_id),
  });
  return success(res, data);
}

async function deleteAccount(req, res) {
  return success(res, await accountService.deleteAccount(req.userId));
}

module.exports = { progress, gameOver, continueGame, deleteAccount };
