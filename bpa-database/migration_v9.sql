-- ============================================================
-- LCC BPA v9 — Add signature_url to document_signatories
-- ============================================================
USE lcc_bpa;

ALTER TABLE document_signatories
  ADD COLUMN signature_url TEXT DEFAULT NULL AFTER credentials;
