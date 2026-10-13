-- ============================================================
-- LCC BPA - La Carlota City Peddler Business Permit Application
-- Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS lcc_bpa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lcc_bpa;

-- ============================================================
-- ADMINS
-- ============================================================
CREATE TABLE admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','admin') DEFAULT 'admin',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- USERS (PEDDLERS)
-- ============================================================
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  address TEXT,
  id_type VARCHAR(80),
  id_number VARCHAR(80),
  id_photo_url VARCHAR(500),
  selfie_url VARCHAR(500),
  verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
  verified_by INT UNSIGNED,
  verified_at TIMESTAMP NULL,
  rejection_reason TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (verified_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- VENDOR LOCATIONS / SLOTS
-- ============================================================
CREATE TABLE vendor_locations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  area_type ENUM('saturday_market') DEFAULT 'saturday_market',
  slot_number VARCHAR(20),
  status ENUM('available','occupied','inactive') DEFAULT 'available',
  created_by INT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- APPLICATIONS
-- ============================================================
CREATE TABLE applications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  application_number VARCHAR(30) NOT NULL UNIQUE,
  type ENUM('new','renewal') DEFAULT 'new',
  renewed_from_permit_id INT UNSIGNED NULL,
  business_name VARCHAR(200) NOT NULL,
  business_type VARCHAR(100),
  products_sold TEXT,
  preferred_location_id INT UNSIGNED,
  status ENUM('pending','under_review','approved','rejected','cancelled') DEFAULT 'pending',
  reviewed_by INT UNSIGNED,
  reviewed_at TIMESTAMP NULL,
  rejection_reason TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (preferred_location_id) REFERENCES vendor_locations(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES admins(id) ON DELETE SET NULL,
  FOREIGN KEY (renewed_from_permit_id) REFERENCES permits(id) ON DELETE SET NULL
);

-- ============================================================
-- APPLICATION DOCUMENTS
-- ============================================================
CREATE TABLE application_documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id INT UNSIGNED NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'PHP',
  payment_method VARCHAR(50),
  paymongo_payment_id VARCHAR(200),
  paymongo_source_id VARCHAR(200),
  paymongo_checkout_url TEXT,
  status ENUM('pending','paid','failed','refunded','verified') DEFAULT 'pending',
  verified_by INT UNSIGNED,
  verified_at TIMESTAMP NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- PERMITS
-- ============================================================
CREATE TABLE permits (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id INT UNSIGNED NOT NULL UNIQUE,
  user_id INT UNSIGNED NOT NULL,
  permit_number VARCHAR(50) NOT NULL UNIQUE,
  issued_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  pdf_url VARCHAR(500),
  status ENUM('active','expired','revoked') DEFAULT 'active',
  renewed_from_permit_id INT UNSIGNED NULL,
  issued_by INT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by) REFERENCES admins(id) ON DELETE SET NULL,
  FOREIGN KEY (renewed_from_permit_id) REFERENCES permits(id) ON DELETE SET NULL
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED,
  admin_id INT UNSIGNED,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('application','payment','permit','system') DEFAULT 'system',
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED,
  action VARCHAR(100) NOT NULL,
  target_table VARCHAR(80),
  target_id INT UNSIGNED,
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- WEEKLY REPORTS
-- ============================================================
CREATE TABLE weekly_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_peddlers INT DEFAULT 0,
  total_payments DECIMAL(12,2) DEFAULT 0,
  total_permits_issued INT DEFAULT 0,
  total_applications INT DEFAULT 0,
  report_data JSON,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SEED: Default Super Admin
-- password: Admin@1234
-- ============================================================
INSERT INTO admins (name, email, password_hash, role) VALUES
('LCC Admin', 'admin@lcc.gov.ph', '$2y$12$v.UabK1r9qGcMRnR30ogPenulpVde6K9foUx5.RUsElH9ggDVK/l6', 'super_admin');

-- ============================================================
-- SEED: Sample Vendor Locations (La Carlota City Saturday Market)
-- ============================================================
INSERT INTO vendor_locations (name, description, latitude, longitude, area_type, slot_number, status, created_by) VALUES
('Slot A-01', 'Saturday Market - Row A, Slot 1', 10.4274, 122.9228, 'saturday_market', 'A-01', 'available', 1),
('Slot A-02', 'Saturday Market - Row A, Slot 2', 10.4275, 122.9229, 'saturday_market', 'A-02', 'available', 1),
('Slot A-03', 'Saturday Market - Row A, Slot 3', 10.4276, 122.9230, 'saturday_market', 'A-03', 'occupied', 1),
('Slot B-01', 'Saturday Market - Row B, Slot 1', 10.4274, 122.9232, 'saturday_market', 'B-01', 'available', 1),
('Slot B-02', 'Saturday Market - Row B, Slot 2', 10.4275, 122.9233, 'saturday_market', 'B-02', 'available', 1),
('Daily Stall 01', 'Daily Vending Area - Stall 1', 10.4280, 122.9235, 'saturday_market', 'D-01', 'available', 1),
('Daily Stall 02', 'Daily Vending Area - Stall 2', 10.4281, 122.9236, 'saturday_market', 'D-02', 'available', 1),
('Reservable Zone 1', 'Event Area - Zone 1', 10.4285, 122.9240, 'saturday_market', 'R-01', 'available', 1);
