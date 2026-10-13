-- ============================================================
-- LCC BPA v2 Migration
-- Run this on top of schema.sql
-- ============================================================

USE lcc_bpa;

-- ============================================================
-- ALTER USERS: add onboarding_step tracking
-- ============================================================
ALTER TABLE users
  ADD COLUMN onboarding_step TINYINT DEFAULT 0 COMMENT '0=not started,1=docs done,2=assistants done,3=selfie done=complete',
  ADD COLUMN onboarding_completed TINYINT(1) DEFAULT 0;

-- ============================================================
-- USER VERIFICATION DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  doc_category ENUM('primary_id','secondary_id','barangay_clearance','old_business_permit','selfie','product_photo') NOT NULL,
  id_type VARCHAR(120),           -- e.g. "Philippine Passport"
  file_url VARCHAR(600) NOT NULL,
  original_name VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- USER ASSISTANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_assistants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  relationship VARCHAR(80),
  phone VARCHAR(20),
  address TEXT,
  photo_url VARCHAR(600),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- Add new routes to index.php (handled in PHP, not SQL)
-- ============================================================
