# Waddle — Connections & Multi-Tenant WhatsApp

Companion to [BUILD.md](BUILD.md). Covers the **Connections hub** (channel linking surface) and the path from a single shared WhatsApp session to **per-company** sessions. Email (V1) shares the same Connections surface.

**Design calls already made:**
- A Baileys session is a long-lived WebSocket + crypto keys, not a heavy app → **session-manager pattern, not container-per-user.**
- Routing is **O(1)** by construction (hash-map registry); the linear cost is **memory**, managed with lazy-loading.
- Kubernetes/Docker only enter at Phase 2 as a *shardable worker fleet*, never a pod/container per user.

---

## ✅ Phase 0 — Connections demo (done)
- [x] `/connections` hub page — visual WhatsApp channel card (idle / linking / connected)
- [x] Permanent sidebar entry + live status dot (green/amber)
- [x] Pairing-code path alongside QR
- [x] Disconnect / unlink flow
- [x] `/status` returns `{status, phone, since}`
- [x] Email card as *Coming soon* slot

---

## 🔨 Phase 1 — Multi-tenant WhatsApp (build order A → B → C → D)

### 1A — Durable, per-tenant auth (linchpin — do first) ✅
- [x] Migration `008_whatsapp_auth.sql`: `whatsapp_auth` table, PK `(company_id, data_key)`
- [x] `usePostgresAuthState(companyId)` — custom Baileys `AuthenticationState` adapter (creds + Signal keys as rows)
- [x] `clearWhatsAppAuth(companyId)` — replaces the `.baileys-auth` folder wipe on logout
- [x] Retire `useMultiFileAuthState` / `.baileys-auth`

### 1B — SessionManager (O(1) registry) ✅
- [x] `Map<companyId, WhatsAppSession>` — no per-message scans / `.find`
- [x] Singleton `WhatsAppService` → per-company `WhatsAppSession` carrying its `companyId`
- [x] Inbound `messages.upsert` scoped to that company's negotiation agent (one handler per session)
- [x] Outbound: look up session by `companyId` before send (`negotiation.companyId` threaded through the agent)

### 1C — Smoothness baked in ✅
- [x] Lazy-load sessions (created on demand via `ensure()`; not all at boot — only companies with active negotiations are warmed)
- [x] Idle-out inactive sessions (30-min TTL sweeper; `setIdleGuard` keeps companies with active negotiations alive so no reply is missed)
- [x] Jittered exponential backoff on reconnect (2s → 60s + jitter)
- [x] Per-session failure isolation (per-session try/catch + `generation` guards; inbound handler errors caught in the manager)

### 1D — Company-scope API + frontend ✅
- [x] Derive `companyId` from the authenticated user in all `/api/whatsapp/*` routes (`requireAuth` + `companyOf`)
- [x] Connections page + `useWhatsAppStatus` operate on the current user's company session (automatic — `apiFetch` sends the token; backend resolves the company)
- [x] Removed the unauthenticated `/qr-page` dev helper (superseded by the in-app Connections UI)

---

## 📧 V1 Email hub — **Decision: Gmail API, send-as-you**

### Email A — Connect & client (linchpin) ✅
- [x] Migration `009_email_accounts.sql` — per-company mailbox + refresh token + `history_id` sync cursor
- [x] `emailAccounts.ts` queries (upsert keeps existing refresh_token when Google omits it)
- [x] `gmailClient.ts` — consent URL, code exchange, per-company authed client, `sendAsUser` (threaded), `listThreadsWithSupplier` (scoped read)
- [x] Routes: `GET /connect` + `/connect/callback` (signed-state OAuth), `GET /status`, `POST /disconnect`, `POST /send` (send-as-user), `POST /preview` (draft)
- [x] Separate "Connect email" consent flow (incremental auth) — login stays lightweight
- [x] Live Email card in Connections (connect / connected / disconnect, OAuth round-trip notice)
- [x] Smoke-tested: auth gating, `status`, and `/connect` → Google consent with `gmail.readonly`+`gmail.send`, offline, signed state

**Before the connect flow works end-to-end (Google Cloud setup — your step):**
- [ ] Enable Gmail API in the Google Cloud project
- [ ] Add redirect URI `${BACKEND_URL}/api/email/connect/callback` to the OAuth client
- [ ] Add the Gmail scopes to the consent screen + add yourself as a **test user** (scopes are unverified)

### Email B — Thread ↔ RFQ matching + tracking (next)
- [ ] Match inbound supplier emails to RFQs/negotiations by supplier address + thread id
- [ ] Incremental sync via `history_id` (poll or Gmail push/Pub-Sub)
- [ ] AI-drafted replies in-thread → **human approve/send** (reuse `generateEmailDraft` + `sendAsUser`)
- [ ] Supplier-progress + thread view in the dashboard (email as a channel alongside WhatsApp)

---

## 🌐 Phase 2 — Scale out (later, not now)
- [ ] Extract stateful **WhatsApp worker** service (sockets only)
- [ ] Shard companies by `companyId` (consistent hashing)
- [ ] Redis/queue for send + inbound routing (solves sticky-session problem)
- [ ] Containerize the **worker** (many sessions per container)
- [ ] Proxy-per-session / IP-reputation strategy (ban avoidance)
- [ ] Event-loop lag monitoring (`perf_hooks`) as the smoothness signal
- [ ] K8s only if scale demands → **StatefulSet + sharding**, never pod-per-user
