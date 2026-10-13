-- ============================================================
-- LCC BPA v5 — Add num_employees to users and applications
-- ============================================================
USE lcc_bpa;

-- Add num_employees field to users table (for onboarding phase)
ALTER TABLE users
  ADD COLUMN num_employees TINYINT UNSIGNED DEFAULT 1 AFTER ctc_number;

-- Add num_employees field to applications table (for application submission)
ALTER TABLE applications
  ADD COLUMN num_employees TINYINT UNSIGNED DEFAULT 0 AFTER products_sold;
