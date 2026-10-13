-- ============================================================
-- LCC BPA v4 — Add middle_name, age, civil_status, ctc_number to users
-- ============================================================
USE lcc_bpa;

ALTER TABLE users
  ADD COLUMN middle_name  VARCHAR(80)  NULL AFTER last_name,
  ADD COLUMN age          TINYINT UNSIGNED NULL AFTER middle_name,
  ADD COLUMN civil_status ENUM('single','married','widowed','separated') NULL AFTER age,
  ADD COLUMN ctc_number   VARCHAR(50)  NULL AFTER civil_status;
