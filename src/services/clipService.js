const crypto = require('crypto');
const env = require('../config/env');
const { pool } = require('../db');
const { ApiError } = require('../lib/apiError');
const { isMp4 } = require('../lib/mp4');
const bunny = require('./bunnyClient');
const logger = require('../logger');

/** Paylaşım klibini Bunny CDN'e yükler ve herkese açık adresini döner. */
async function uploadClip(userId, buffer) {
  if (!bunny.configured()) throw ApiError.server('bunny storage not configured');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw ApiError.badRequest('empty body');
  if (buffer.length > env.clipMaxBytes) throw ApiError.badRequest('clip too large');
  if (!isMp4(buffer)) throw ApiError.badRequest('not an mp4');

  const [[{ today }]] = await pool.query(
    'SELECT COUNT(*) AS today FROM clips WHERE user_id = ? AND created_at > NOW(3) - INTERVAL 1 DAY',
    [userId],
  );
  if (Number(today) >= env.clipDailyLimit) throw ApiError.tooMany('daily clip limit');

  const id = crypto.randomUUID();
  const now = new Date();
  const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const path = `clips/${month}/${id}.mp4`;
  const url = await bunny.upload(path, buffer, 'video/mp4');
  await pool.query('INSERT INTO clips (id, user_id, storage_path, bytes) VALUES (?, ?, ?, ?)', [
    id,
    userId,
    path,
    buffer.length,
  ]);
  logger.info('clip.uploaded', { user_id: userId, bytes: buffer.length, path });
  return { url };
}

module.exports = { uploadClip };
