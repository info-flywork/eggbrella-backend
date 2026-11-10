const clipService = require('../services/clipService');
const { success } = require('../lib/response');

/** Gövde ham MP4'tür (Content-Type: video/mp4). */
async function upload(req, res) {
  return success(res, await clipService.uploadClip(req.userId, req.body), 201);
}

module.exports = { upload };
