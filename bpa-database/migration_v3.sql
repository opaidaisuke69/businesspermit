-- ============================================================
-- LCC BPA v3 — Email Verification & Password Reset
-- ============================================================
USE lcc_bpa;

-- Email verification tokens (OTP code or link token)
CREATE TABLE IF NOT EXISTS email_tokens (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  email        VARCHAR(150) NOT NULL,
  token        VARCHAR(64)  NOT NULL UNIQUE,  -- link token (UUID)
  otp          VARCHAR(6),                    -- 6-digit OTP
  type         ENUM('email_verify','password_reset') NOT NULL,
  method       ENUM('code','link') NOT NULL DEFAULT 'code',
  used         TINYINT(1) DEFAULT 0,
  expires_at   TIMESTAMP NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Track email verification status on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL;
