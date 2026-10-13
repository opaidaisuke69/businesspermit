-- ============================================================
-- Migration v14: Add Renewal Support
-- ============================================================

-- Add renewal tracking columns to applications table
ALTER TABLE applications 
  ADD COLUMN renewed_from_permit_id INT UNSIGNED NULL AFTER type,
  ADD FOREIGN KEY (renewed_from_permit_id) REFERENCES permits(id) ON DELETE SET NULL;

-- Add renewal tracking to permits table  
ALTER TABLE permits
  ADD COLUMN renewed_from_permit_id INT UNSIGNED NULL AFTER status,
  ADD FOREIGN KEY (renewed_from_permit_id) REFERENCES permits(id) ON DELETE SET NULL;

-- Add index for faster renewal eligibility queries
CREATE INDEX idx_permits_expiry ON permits(expiry_date, status);
CREATE INDEX idx_applications_type ON applications(type, user_id);
