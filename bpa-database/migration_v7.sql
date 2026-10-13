-- ============================================================
-- LCC BPA v7 — Add gender to users table
-- ============================================================
USE lcc_bpa;

ALTER TABLE users
  ADD COLUMN gender ENUM('male','female','other') DEFAULT NULL AFTER age;
