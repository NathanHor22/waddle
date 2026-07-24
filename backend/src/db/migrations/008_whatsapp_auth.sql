-- ── Per-company WhatsApp auth state ──────────────────────────────────────────
-- Durable home for Baileys credentials + Signal keys, replacing the on-disk
-- `.baileys-auth` folder. Keyed by company so each tenant links its own number,
-- and so sessions survive restarts/redeploys without re-scanning the QR.
--
-- data_key is either 'creds' or '<category>-<id>' (e.g. 'session-60123...',
-- 'pre-key-42'). data_value is the BufferJSON-encoded JSON string for that key.
CREATE TABLE whatsapp_auth (
  company_id UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data_key   TEXT        NOT NULL,
  data_value TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, data_key)
);

-- Primary key already indexes (company_id, data_key); this covers the frequent
-- "load everything for this company" and "wipe this company" access patterns.
CREATE INDEX idx_whatsapp_auth_company ON whatsapp_auth(company_id);
