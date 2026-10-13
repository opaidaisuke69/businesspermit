-- ============================================================
-- Migration v13: Remove Reservations Feature
-- ============================================================
-- This migration removes all reservation-related functionality
-- as the system does not support reservations.

-- Drop reservations table
DROP TABLE IF EXISTS reservations;

-- Update notifications table to remove 'reservation' type
ALTER TABLE notifications 
  MODIFY COLUMN type ENUM('application','payment','permit','system') DEFAULT 'system';

-- Update vendor_locations status enum to remove 'reserved'
-- Note: This will convert any 'reserved' status to 'available'
UPDATE vendor_locations SET status = 'available' WHERE status = 'reserved';

-- Update the enum to remove 'reserved' option
ALTER TABLE vendor_locations 
  MODIFY COLUMN status ENUM('available','occupied','inactive') DEFAULT 'available';

-- Update area_type enum to only allow 'saturday_market'
ALTER TABLE vendor_locations 
  MODIFY COLUMN area_type ENUM('saturday_market') DEFAULT 'saturday_market';
