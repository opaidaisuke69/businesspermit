-- ============================================================
-- LCC BPA v6 — Permit Fees Settings + Payment Flow Rework
-- ============================================================
USE lcc_bpa;

-- Permit fee settings table (admin-configurable)
CREATE TABLE IF NOT EXISTS permit_fees (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fee_key VARCHAR(80) NOT NULL UNIQUE,
  label VARCHAR(150) NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  updated_by INT UNSIGNED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- Seed default fee items
INSERT INTO permit_fees (fee_key, label, amount, description) VALUES
  ('mayors_permit',     "Mayor's Permit",        500.00, 'Annual Mayor''s Permit fee'),
  ('sanitary_permit',   'Sanitary Permit',        200.00, 'Annual Sanitary Permit fee'),
  ('health_certificate','Health Certificate',     150.00, 'Health Certificate fee per person'),
  ('occupational_tax',  'Occupational Tax',       110.00, 'Per papag/lag-it (multiplied by count)'),
  ('garbage_fee',       'Garbage Fee',            100.00, 'Annual garbage collection fee'),
  ('brgy_clearance',    'BRGY. Clearance',        50.00,  'Barangay Clearance fee'),
  ('peddlers_tax',      'Peddlers Tax',           200.00, 'Annual Peddlers Tax')
ON DUPLICATE KEY UPDATE label=VALUES(label);

-- Add num_papag to applications if not exists
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS num_papag TINYINT UNSIGNED DEFAULT 0 AFTER num_employees;

-- Add payment_method and rejection_reason to payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_method_type ENUM('cash','gcash','maya','qrph','card','other') DEFAULT 'cash' AFTER payment_method,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT AFTER verified_at,
  ADD COLUMN IF NOT EXISTS fee_breakdown JSON AFTER amount;

-- Allow payments to be rejected
ALTER TABLE payments
  MODIFY COLUMN status ENUM('pending','paid','failed','refunded','verified','rejected') DEFAULT 'pending';

-- Permits: allow two permit types per application (MPP + Sanitary)
ALTER TABLE permits
  ADD COLUMN IF NOT EXISTS permit_type ENUM('mayors_permit','sanitary_permit') DEFAULT 'mayors_permit' AFTER permit_number,
  ADD COLUMN IF NOT EXISTS business_name VARCHAR(200) AFTER permit_type;

-- Drop unique constraint on application_id so we can have 2 permits per application
ALTER TABLE permits DROP INDEX IF EXISTS application_id;
ALTER TABLE permits ADD UNIQUE KEY unique_app_type (application_id, permit_type);
