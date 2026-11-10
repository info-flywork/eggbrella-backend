-- RevenueCat coin paketi işlemleri. transaction_id = mağaza işlem id'si (webhook transaction_id == REST store_transaction_id),
-- böylece webhook ve /purchases/sync aynı işlemi iki kez yükleyemez. Skinler non-consumable'dır; sahipliklerini
-- RevenueCat tutar, burada kaydedilmez.
CREATE TABLE IF NOT EXISTS purchase_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_id VARCHAR(191) NOT NULL,
  rc_transaction_id VARCHAR(191) NULL,
  user_id CHAR(36) NOT NULL,
  product_id VARCHAR(191) NOT NULL,
  coins INT UNSIGNED NOT NULL DEFAULT 0,
  source ENUM('webhook','sync') NOT NULL,
  status ENUM('credited','refunded') NOT NULL,
  environment VARCHAR(16) NULL,
  raw LONGTEXT NULL,
  refunded_at DATETIME(3) NULL,
  refund_raw LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchase_transactions_tx (transaction_id),
  KEY idx_purchase_transactions_user (user_id),
  CONSTRAINT fk_purchase_transactions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
