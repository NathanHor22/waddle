# Waddle — Build Checklist

The agreed scope, reframed around the **RFQ as the unit of work** and an **agentic, human-in-the-loop** flow.

**North star:** a business owner says what they need in plain language → Waddle autonomously sources, contacts, and negotiates across WhatsApp + email → pauses at approval gates → comes back with a decision-ready comparison. The human is pulled in for ~3 approvals, not 6 conversations.

**The loop (Claude-Code-style, async, in-app approvals):**
```
Agent captures need (natural language → structured RFQ, asks only if gaps)
  → Sources suppliers → [Gate 1: approve list — optional per RFQ]
  → Negotiates many suppliers autonomously, writing quotes as it goes
  → [Gate 2: approve price before committing — ALWAYS ON, cannot disable]
  → Comparison ready → [Gate 3: pick winner — optional per RFQ]
```

Items marked _(change)_ reshape existing code; _(reuse)_ wire existing pieces onto the new spine; everything else is net-new.

---

## Phase 0 — Dev environment & tooling
_Makes the repo easy to share with Nigel. Solves the ".env every time" annoyance and the "install everything by hand" chore. Independent of the app build — can happen anytime._

### Doppler (shared secrets vault — fixes the `.env` annoyance)
- [ ] Create a Doppler project for Waddle; add all secrets (`ANTHROPIC_API_KEY`, `DATABASE_URL`, `LUA_API_KEY`, Google OAuth, supplier creds)
- [ ] Switch local dev to `doppler run -- npm run dev` (no secret file on disk)
- [ ] Sync Doppler → Railway (backend) and Vercel (frontend) for production
- [ ] Keep `env.example` committed as documentation of _which_ keys exist
- [ ] Nigel onboarding = `doppler login` then `doppler run -- npm run dev` (no copying keys)

### Docker (reproducible local setup — optional, lower priority)
- [ ] `docker-compose.yml` with a **Postgres service** so nobody hand-installs a database
- [ ] _(optional, later)_ Dockerfile for the backend (Node + Playwright deps) — skip during active dev; hot-reload + Playwright in-container is fiddly
- [ ] Secrets injected at runtime (`doppler run -- docker compose up`) — **never baked into the image**
- [ ] README onboarding section so setup becomes one command
- [ ] **Not doing:** Kubernetes (overkill for this stage); Dockerizing production (Railway handles it)

---

## Phase 1 — The spine (data model + quote persistence)
_Unlocks everything else. Mostly migrations + wiring, low risk. **Nothing in Phases 2–5 can be built until this exists.**_

- [ ] `companies` table (name, SSM/ACRA reg no., country MY/SG, default currency)
- [ ] `rfqs` table — the spec: product/chemical, grade/concentration, quantity, packaging, delivery location, needed-by date, budget/target, status, `autonomy` setting
- [ ] `quotes` table — price, MOQ, lead time, payment terms, incoterm, **spec-match fields** (quoted grade/concentration vs requested), source channel (whatsapp/email), supplier ref
- [ ] _(change)_ `negotiations` gets `rfq_id` — becomes a child of an RFQ
- [ ] _(change)_ `waddle_for_me_jobs` folds into `rfqs` (one RFQ + `autonomy` setting) instead of a parallel silo
- [ ] _(change)_ Ownership key `user_id` → `company_id` on sessions/negotiations/rfqs (keep user_id = creator)
- [ ] _(change)_ Add `awaiting_approval` to the negotiation/RFQ state machine
- [ ] **Persist extracted quotes to columns** — wire `negotiationAgent.ts` to write price/MOQ/lead-time into `quotes` instead of only emitting over SSE
- [ ] _(change)_ `emailAgent.ts` writes to the **same** `quotes` rows so the comparison is channel-agnostic
- [ ] TypeScript types for Company / RFQ / Quote / ApprovalGate in `types.ts`

---

## Phase 2 — Approval gates (the human-in-the-loop loop)
_Dashboard-only approvals. The agent reaches a gate, sets `awaiting_approval`, surfaces it in the app, waits for a yes, then continues._

- [ ] Approval-gate concept as first-class: which gate, what the agent proposes, pending/approved/rejected
- [ ] **Gate 2 — price approval, always-on, non-disableable** — agent pauses before committing a price to the supplier
- [ ] Gate 1 — approve supplier list (optional per RFQ via autonomy)
- [ ] Gate 3 — pick winner (optional per RFQ via autonomy)
- [ ] Agent pause/resume: reach gate → `awaiting_approval` → wait → resume on dashboard approval
- [ ] In-app approval actions (approve / reject / counter) wired to resume the agent
- [ ] _(later, flagged)_ Quiet "approval waiting" email nudge — not v1-critical

---

## Phase 3 — Agent captures the need (the front door, NOT a form)
- [ ] Natural language → structured RFQ extraction (agent fills the `rfqs` spec from plain language)
- [ ] _(reuse)_ Agent asks 1–2 clarifying questions only when the spec has gaps (existing question flow)
- [ ] Save RFQ as draft before sending
- [ ] _(change)_ One unified entry point → creates an RFQ with an autonomy setting (merges manual + "Waddle for me")

---

## Phase 4 — RFQ-centric dashboard (the payoff / report-back surface)
- [ ] RFQ board by status (Draft → Out for quotes → Quotes in → Negotiating → Awaiting approval → Decided → Closed)
- [ ] Per-RFQ row summary (product, qty, # contacted, # quotes, best price, needed-by, status)
- [ ] Prominent "New RFQ" entry
- [ ] Single-RFQ view — spec at top, live supplier panel, transcripts, gate prompts, decision action
- [ ] **Comparison table** — side-by-side quotes with **spec-mismatch flagging**
- [ ] Decision action — pick winner → export → close RFQ _(reuse Excel export)_
- [ ] Human-takeover / jump-into-conversation button
- [ ] _(reuse)_ Live WhatsApp transcript per supplier (messages already stored)

---

## Phase 5 — Company onboarding (tenancy)
- [ ] Company profile creation after first login
- [ ] _(reuse)_ Connect company WhatsApp during onboarding (Baileys QR — the activation step)
- [ ] _(reuse)_ Google login already built

---

## Deferred — the spine makes these cheaper later, not v1
- [ ] Multi-user staff per company
- [ ] Supplier list CSV upload / paste to seed real suppliers
- [ ] Per-customer memory / learning (history queries over `quotes`)
- [ ] Negotiation guardrails beyond the price gate (explicit walk-away, spec lock)
- [ ] Negotiation rounds ("everyone beat the best price" / counter one supplier)
- [ ] Supplier verification signals (SSM, SIRIM/safety certs, past RFQ count) + provenance display
- [ ] Unify the two agent personas (Lua search vs negotiation) into one Waddle voice
- [ ] Pre-fill RFQ from company's past RFQs
- [ ] Meta Cloud API migration (24h window, templates, embedded signup)

## Parked — the "next product," not this build
- [ ] PO generation · Invoicing · Payment rails · ERP integration · Inventory · Supplier-side portal
