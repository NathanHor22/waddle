-- ── Approval gates (human-in-the-loop checkpoints) ───────────────────────────
-- A gate is a point where the agent stops and waits for a buyer decision.
--   price         — agreed terms reached; commit? (always on, per negotiation)
--   supplier_list — approve who we contact before any outbound (per RFQ)
--   winner        — pick the winning quote to close the RFQ (per RFQ)
-- 'countered' resolves the current gate; the agent keeps negotiating and may
-- raise a fresh gate later.
CREATE TABLE approval_gates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id          UUID        REFERENCES rfqs(id)         ON DELETE CASCADE,
  negotiation_id  UUID        REFERENCES negotiations(id) ON DELETE CASCADE,

  gate_type       TEXT        NOT NULL CHECK (gate_type IN ('supplier_list','price','winner')),
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','countered')),

  proposal        JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- what the agent asks the buyer to approve
  resolution_note TEXT,                                      -- buyer's reply (e.g. counter target)
  resolved_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_gates_status         ON approval_gates(status);
CREATE INDEX idx_approval_gates_negotiation_id ON approval_gates(negotiation_id);
CREATE INDEX idx_approval_gates_rfq_id         ON approval_gates(rfq_id);

-- At most one open gate per negotiation at a time.
CREATE UNIQUE INDEX idx_approval_gates_one_open
  ON approval_gates(negotiation_id)
  WHERE status = 'pending' AND negotiation_id IS NOT NULL;
