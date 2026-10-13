-- Migration v10: Add PayMongo Integration Fields
-- Run this after v9

-- Add PayMongo fields to payments table
ALTER TABLE payments 
ADD COLUMN paymongo_intent_id VARCHAR(255) NULL,
ADD COLUMN paymongo_data JSON NULL,
ADD INDEX idx_paymongo_intent (paymongo_intent_id);

-- Update payments table to support online payment methods
ALTER TABLE payments 
MODIFY COLUMN payment_method ENUM('cash', 'gcash', 'paymaya', 'grab_pay', 'card', 'bank_transfer') DEFAULT 'cash';

-- Add payment_gateway field to track which gateway was used
ALTER TABLE payments 
ADD COLUMN payment_gateway VARCHAR(50) NULL AFTER payment_method;