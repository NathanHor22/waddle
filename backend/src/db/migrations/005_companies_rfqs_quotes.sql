-- ── Companies (tenancy root) ─────────────────────────────────────────────────
CREATE TABLE companies (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  registration_no  TEXT,                                    -- SSM (MY) / ACRA (SG)
  country          TEXT        NOT NULL DEFAULT 'MY' CHECK (country IN ('MY','SG')),
  default_currency TEXT        NOT NULL DEFAULT 'MYR',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users belong to a company (the tenancy key). Nullable during the transition
-- from single-company demo to multi-tenant.
ALTER TABLE users ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX idx_users_company_id ON users(company_id);

-- ── RFQs (the unit of work) ──────────────────────────────────────────────────
-- One "what do you need to buy?" request that fans out to many suppliers.
CREATE TABLE rfqs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        REFERENCES companies(id) ON DELETE CASCADE,
  created_by        UUID        REFERENCES users(id) ON DELETE SET NULL,

  -- The spec. The agent fills these from natural language; grade matters for chemicals.
  product           TEXT        NOT NULL,
  grade             TEXT,                                   -- concentration / grade
  quantity          TEXT,
  packaging         TEXT,
  delivery_location TEXT,
  needed_by         DATE,
  target_price      TEXT,
  currency          TEXT        NOT NULL DEFAULT 'MYR',

  -- Autonomy: which approval gates are active for this RFQ.
  -- The PRICE gate (Gate 2) is always on and enforced in code — deliberately not
  -- a column here, because it must never be configurable away.
  require_list_approval   BOOLEAN NOT NULL DEFAULT TRUE,    -- Gate 1: approve supplier list
  require_winner_approval BOOLEAN NOT NULL DEFAULT TRUE,    -- Gate 3: approve final winner

  status            TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN (
                        'draft','out_for_quotes','quotes_in',
                        'negotiating','awaiting_approval','decided','closed'
                      )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rfqs_company_id ON rfqs(company_id);
CREATE INDEX idx_rfqs_status     ON rfqs(status);

-- ── Negotiations become children of an RFQ + company ─────────────────────────
-- Also gain the 'awaiting_approval' state so the agent can pause at a gate.
ALTER TABLE negotiations ADD COLUMN rfq_id     UUID REFERENCES rfqs(id)      ON DELETE CASCADE;
ALTER TABLE negotiations ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX idx_negotiations_rfq_id ON negotiations(rfq_id);

ALTER TABLE negotiations DROP CONSTRAINT negotiations_status_check;
ALTER TABLE negotiations ADD CONSTRAINT negotiations_status_check
  CHECK (status IN ('sent','negotiating','awaiting_approval','done','failed'));

-- ── Quotes (one structured offer per supplier per RFQ) ───────────────────────
-- This is what the comparison table reads. Channel-agnostic so a WhatsApp quote
-- and an email quote sit side by side. Previously extracted then dropped over SSE.
CREATE TABLE quotes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id          UUID        REFERENCES rfqs(id)         ON DELETE CASCADE,
  negotiation_id  UUID UNIQUE REFERENCES negotiations(id) ON DELETE SET NULL,

  supplier        TEXT        NOT NULL,
  channel         TEXT        NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','email')),

  -- Normalised offer fields, accumulated as the negotiation firms up.
  price           TEXT,
  currency        TEXT,
  moq             TEXT,
  lead_time       TEXT,
  payment_terms   TEXT,
  incoterm        TEXT,

  -- Spec-match: did the supplier quote the product actually requested?
  quoted_spec     TEXT,
  spec_match      TEXT        NOT NULL DEFAULT 'unknown' CHECK (spec_match IN ('match','mismatch','unknown')),
  spec_match_note TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_rfq_id ON quotes(rfq_id);

-- ── Sessions link to a company too ───────────────────────────────────────────
ALTER TABLE sessions ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX idx_sessions_company_id ON sessions(company_id);
