-- QueueSmart Ticketmaster — A4 schema for MySQL 8.4.
-- No sample data or destructive DROP statements are included.
-- The selected database is queuesmart_db, NOT Aiven's defaultdb.
USE queuesmart_db;

CREATE TABLE IF NOT EXISTS user_credentials (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(254) NOT NULL,
  password_salt CHAR(32) NOT NULL,
  password_digest CHAR(128) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_credentials_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  contact_phone VARCHAR(40) NULL,
  preferences JSON NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES user_credentials(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tokens should be stored as SHA-256 hashes, not raw Bearer tokens.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (token_hash),
  KEY idx_auth_sessions_user (user_id),
  KEY idx_auth_sessions_expiry (expires_at),
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES user_credentials(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL,
  expected_duration SMALLINT UNSIGNED NOT NULL,
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_services_name (name),
  CONSTRAINT chk_services_duration CHECK (expected_duration BETWEEN 1 AND 480)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One Queue per Service. Service is_open and Queue status MUST be updated
-- together in a transaction when a service is opened/closed.
CREATE TABLE IF NOT EXISTS queues (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_id BIGINT UNSIGNED NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_queues_service (service_id),
  CONSTRAINT fk_queues_service FOREIGN KEY (service_id) REFERENCES services(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Terminal entries are retained to preserve history and notification FKs.
-- Only status='waiting' is an active queue participant.
-- Generated column UNIQUE permits multiple NULLs, but only ONE active
-- queue entry per user, across all services, including concurrent requests.
CREATE TABLE IF NOT EXISTS queue_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  queue_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  priority ENUM('standard','priority') NOT NULL DEFAULT 'standard',
  order_seq BIGINT UNSIGNED NOT NULL,
  status ENUM('waiting','served','left','removed') NOT NULL DEFAULT 'waiting',
  joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at DATETIME(3) NULL,
  active_user_id BIGINT UNSIGNED GENERATED ALWAYS AS
    (CASE WHEN status = 'waiting' THEN user_id ELSE NULL END) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_queue_entries_active_user (active_user_id),
  KEY idx_entries_queue_order (queue_id, status, priority, order_seq, id),
  KEY idx_entries_user (user_id),
  CONSTRAINT fk_entries_queue FOREIGN KEY (queue_id) REFERENCES queues(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_entries_user FOREIGN KEY (user_id) REFERENCES user_credentials(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- History.id deliberately matches the API's A3 convention: one history
-- record per queue participation with the queue entry's ID.
CREATE TABLE IF NOT EXISTS history (
  id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  joined_at DATETIME(3) NOT NULL,
  ended_at DATETIME(3) NULL,
  outcome ENUM('Waiting','Served','Left Queue','Removed') NOT NULL DEFAULT 'Waiting',
  PRIMARY KEY (id),
  KEY idx_history_user_joined (user_id, joined_at),
  CONSTRAINT fk_history_entry FOREIGN KEY (id) REFERENCES queue_entries(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES user_credentials(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_history_service FOREIGN KEY (service_id) REFERENCES services(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  entry_id BIGINT UNSIGNED NOT NULL,
  event VARCHAR(40) NOT NULL,
  message VARCHAR(500) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_event_once (entry_id, event),
  KEY idx_notifications_user_created (user_id, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES user_credentials(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_notifications_entry FOREIGN KEY (entry_id) REFERENCES queue_entries(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
