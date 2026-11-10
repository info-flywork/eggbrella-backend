-- Eggbrella başlangıç şeması. MariaDB 10.6+ ve MySQL 8+ uyumlu.

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  device_id VARCHAR(128) NOT NULL,
  platform VARCHAR(16) NULL,
  app_version VARCHAR(32) NULL,
  coins INT UNSIGNED NOT NULL DEFAULT 100,
  best_floor INT UNSIGNED NOT NULL DEFAULT 0,
  games_played INT UNSIGNED NOT NULL DEFAULT 0,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_device_id (device_id),
  KEY idx_users_best_floor (best_floor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  replaced_by_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_tokens_hash (token_hash),
  KEY idx_refresh_tokens_user (user_id),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Biten oyunlar (istatistik / hile incelemesi).
CREATE TABLE IF NOT EXISTS games (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  floor INT UNSIGNED NOT NULL,
  reported_floor INT UNSIGNED NOT NULL,
  coins_collected INT UNSIGNED NOT NULL,
  reported_coins INT UNSIGNED NOT NULL,
  continues_used SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  duration_ms INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_games_user (user_id, created_at),
  CONSTRAINT fk_games_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- İstemci olayları için idempotentlik: aynı (user_id, client_event_id) ikinci kez gelirse saklanan cevap döner.
CREATE TABLE IF NOT EXISTS client_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  client_event_id VARCHAR(64) NOT NULL,
  type VARCHAR(32) NOT NULL,
  response LONGTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_events_user_event (user_id, client_event_id),
  CONSTRAINT fk_client_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Her coin değişikliği (delta negatif olabilir).
CREATE TABLE IF NOT EXISTS coin_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  delta INT NOT NULL,
  balance_after INT UNSIGNED NOT NULL,
  reason VARCHAR(32) NOT NULL,
  ref VARCHAR(191) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_coin_ledger_user (user_id, created_at),
  CONSTRAINT fk_coin_ledger_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bunny CDN'e yüklenen paylaşım klipleri.
CREATE TABLE IF NOT EXISTS clips (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  storage_path VARCHAR(255) NOT NULL,
  bytes INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_clips_user (user_id, created_at),
  CONSTRAINT fk_clips_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
