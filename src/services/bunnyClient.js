// Bunny Storage HTTP API: https://docs.bunny.net/reference/storage-api
const env = require('../config/env');

function configured() {
  const b = env.bunny;
  return Boolean(b.storageZone && b.storagePassword && b.cdnBaseUrl);
}

function storageUrl(path) {
  const b = env.bunny;
  return `https://${b.storageHost}/${encodeURIComponent(b.storageZone)}/${path}`;
}

function publicUrl(path) {
  return `${env.bunny.cdnBaseUrl}/${path}`;
}

/** Dosyayı yükler (aynı yol varsa üzerine yazar). */
async function upload(path, body, contentType) {
  const res = await fetch(storageUrl(path), {
    method: 'PUT',
    headers: { AccessKey: env.bunny.storagePassword, 'Content-Type': contentType },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`bunny upload failed: ${res.status} ${await res.text().catch(() => '')}`);
  return publicUrl(path);
}

async function remove(path) {
  const res = await fetch(storageUrl(path), {
    method: 'DELETE',
    headers: { AccessKey: env.bunny.storagePassword },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok && res.status !== 404) throw new Error(`bunny delete failed: ${res.status}`);
}

module.exports = { configured, upload, remove, publicUrl };
