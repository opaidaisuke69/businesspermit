-- Migration v11: Fix payments table columns for QR Ph / PayMongo
-- Run this after v10

USE lcc_bpa;

-- Add payment_method_type column (stores the raw type: cash, check, qrph, gcash, etc.)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_method_type VARCHAR(50) NULL AFTER payment_method;

-- Widen payment_method to accept qrph
ALTER TABLE payments
  MODIFY COLUMN payment_method VARCHAR(50) DEFAULT 'cash';

-- Ensure payment_gateway column exists
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) NULL;

-- Ensure paymongo_intent_id exists (stores payment link ID or intent ID)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS paymongo_intent_id VARCHAR(255) NULL;

-- Ensure paymongo_data exists
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS paymongo_data JSON NULL;
