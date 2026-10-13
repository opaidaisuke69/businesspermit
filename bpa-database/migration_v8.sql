-- ============================================================
-- LCC BPA v8 — Document Signatories Settings
-- ============================================================
USE lcc_bpa;

CREATE TABLE IF NOT EXISTS document_signatories (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_key   VARCHAR(80)  NOT NULL UNIQUE,
  role_label VARCHAR(150) NOT NULL,
  person_name VARCHAR(200) NOT NULL DEFAULT '',
  credentials VARCHAR(200) NOT NULL DEFAULT '',
  updated_by INT UNSIGNED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
);

INSERT INTO document_signatories (role_key, role_label, person_name, credentials) VALUES
  ('sanitation_inspector', 'Sanitation Inspector III',                    'MARILOU F. SENDICO, RM',      'Sanitation Inspector III'),
  ('city_health_officer',  'CGDH-I / City Health Officer',               'ROMMEL R. SABIG, M.D.',       'CGDH-I / City Health Officer'),
  ('city_mayor',           'City Mayor',                                  'HON. REX R. JALANDOON, MD, MPM', 'City Mayor'),
  ('city_budget_officer',  'City Budget Officer / Acting City Administrator', 'MARLENE E. GARGANTIEL',  'City Budget Officer / Acting City Administrator'),
  ('collecting_officer',   'Collecting Officer',                          '',                            'Collecting Officer')
ON DUPLICATE KEY UPDATE role_label=VALUES(role_label);
