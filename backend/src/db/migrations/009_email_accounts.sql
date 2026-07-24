-- ── Per-company connected email account (Gmail via OAuth) ────────────────────
-- Stores the refresh token so Waddle can read RFQ threads and send replies as
-- the user, in the background, without them being present. One connected mailbox
-- per company for V1 (mirrors the one-WhatsApp-per-company model).
--
-- history_id is Gmail's incremental-sync cursor: the last point we synced to, so
-- we only fetch what changed rather than re-scanning the mailbox.
CREATE TABLE email_accounts (
  company_id    UUID        PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  provider      TEXT        NOT NULL DEFAULT 'gmail',
  email_address TEXT        NOT NULL,
  refresh_token TEXT        NOT NULL,
  history_id    TEXT,                                   -- Gmail incremental-sync cursor
  connected_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
