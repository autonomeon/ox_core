import { Pool } from 'mariadb';

/**
 * Validate some database settings, tables, etc. and add anything missing (e.g. version changes).
 */
export default async function (pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS user_tokens (
    userId INT UNSIGNED NOT NULL,
    token VARCHAR(50) NOT NULL,
    PRIMARY KEY (userId, token),
    INDEX token (token),
    CONSTRAINT FK_user_tokens_users FOREIGN KEY (userId) REFERENCES users (userId) ON UPDATE CASCADE ON DELETE CASCADE
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS banned_users (
    userId INT UNSIGNED NOT NULL,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unban_at TIMESTAMP DEFAULT NULL,
    reason VARCHAR(255),
    PRIMARY KEY (userId),
    CONSTRAINT FK_banned_users_users FOREIGN KEY (userId) REFERENCES users (userId) ON UPDATE CASCADE ON DELETE CASCADE
  )`);

  // install.sql only runs on a fresh database, so an existing install reaches
  // the idempotency key from here instead.
  await pool.query(`ALTER TABLE accounts_transactions
    ADD COLUMN IF NOT EXISTS \`idempotencyKey\` VARCHAR(191) COLLATE utf8mb4_bin DEFAULT NULL,
    ADD UNIQUE KEY IF NOT EXISTS \`accounts_transactions_idempotency_key\` (\`idempotencyKey\`)`);
}
