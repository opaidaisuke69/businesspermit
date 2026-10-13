-- Migration v12: Clean up payments table
-- Removes unused columns and adds paymongo_link_id for Payment Links

USE lcc_bpa;

-- Remove unused legacy columns
ALTER TABLE payments
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS paymongo_payment_id,
  DROP COLUMN IF EXISTS paymongo_source_id,
  DROP COLUMN IF EXISTS paymongo_checkout_url,
  DROP COLUMN IF EXISTS paymongo_data;

-- Rename paymongo_intent_id to paymongo_link_id (more accurate for our use case)
ALTER TABLE payments
  CHANGE COLUMN paymongo_intent_id paymongo_link_id VARCHAR(255) DEFAULT NULL;

-- Update index name
ALTER TABLE payments
  DROP INDEX IF EXISTS idx_paymongo_intent,
  ADD INDEX idx_paymongo_link (paymongo_link_id);
