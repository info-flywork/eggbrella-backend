const { pool, withTransaction } = require('../db');
const { lockUser } = require('./userService');
const bunny = require('./bunnyClient');
const logger = require('../logger');

/**
 * Uygulama içi veri silme (KVKK m.11 / GDPR m.17).
 * - Oyun verileri (oyunlar, coin defteri, istemci olayları, oturumlar, klipler) silinir.
 * - Kullanıcı satırı anonimleştirilir; aynı cihaz tekrar açılırsa yeni hesap oluşur.
 * - CDN'deki klipler silinir (başarısız olanlar loglanır).
 */
async function deleteAccount(userId) {
  const [clips] = await pool.query('SELECT storage_path FROM clips WHERE user_id = ?', [userId]);
  await withTransaction(async (conn) => {
    await lockUser(conn, userId);
    for (const table of ['refresh_tokens', 'games', 'client_events', 'coin_ledger', 'clips']) {
      await conn.query(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
    }
    await conn.query(
      `UPDATE users SET device_id = CONCAT('deleted:', id), platform = NULL, app_version = NULL,
         coins = 0, best_floor = 0, games_played = 0, deleted_at = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [userId],
    );
  });
  let clipsDeleted = 0;
  for (const clip of clips) {
    try {
      await bunny.remove(clip.storage_path);
      clipsDeleted++;
    } catch (err) {
      logger.error('account.clip_delete_failed', { user_id: userId, path: clip.storage_path, error: err.message });
    }
  }
  logger.info('account.deleted', { user_id: userId, clips: clips.length, clips_deleted: clipsDeleted });
  return { deleted: true };
}

module.exports = { deleteAccount };
