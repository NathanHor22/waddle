import { pool } from '../client.js'

// ── Dashboard aggregates ──────────────────────────────────────────────────────
// Everything the home dashboard needs that isn't already covered by the per-RFQ
// board query: money figures (spend/savings/fee), this-week counts, a savings
// sparkline, and a unified activity feed for the WadRail.

export interface DashboardStats {
  spend: number
  savings: number
  fee: number
  currency: string
  decidedCount: number
  thisWeek: { rfqsCreated: number; quotesIn: number; suppliersContacted: number }
  // 12-week cumulative savings, oldest → newest, for the sparkline.
  savingsTrend: number[]
}

export interface ActivityItem {
  id: string
  type: 'send' | 'receive' | 'approve'
  channel: 'web' | 'whatsapp' | 'email'
  text: string
  ts: string // ISO timestamp; the client renders relative time
  link: string | null
}

const FEE_RATE = 0.15 // Waddle's cut of realised savings

// Prices are free-text ("RM 4,000", "4000/MT", "~3.8k"). Pull the first number;
// skip anything we can't read rather than guessing.
function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/,/g, '')
  const m = cleaned.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

export async function getDashboardStats(companyId?: string): Promise<DashboardStats> {
  const scope = companyId ? 'AND r.company_id = $1' : ''
  const params = companyId ? [companyId] : []

  // Decided/closed RFQs with a winner, plus every quote on them. We compute
  // spend = Σ winning price, savings = Σ max(0, highest quote − winning quote).
  const { rows: priced } = await pool.query(
    `SELECT r.id AS rfq_id, r.winning_quote_id, r.updated_at,
            q.id AS quote_id, q.price, q.currency
       FROM rfqs r
       JOIN quotes q ON q.rfq_id = r.id
      WHERE r.status IN ('decided', 'closed')
        AND r.winning_quote_id IS NOT NULL
        ${scope}`,
    params,
  )

  type Bucket = { winning: number | null; max: number; currency: string; week: number }
  const byRfq = new Map<string, Bucket>()
  const now = Date.now()
  const WEEK = 7 * 24 * 60 * 60 * 1000

  for (const row of priced) {
    const price = parsePrice(row.price as string | null)
    if (price === null) continue
    const rfqId = row.rfq_id as string
    const weeksAgo = Math.floor((now - new Date(row.updated_at as Date).getTime()) / WEEK)
    let b = byRfq.get(rfqId)
    if (!b) {
      b = { winning: null, max: 0, currency: (row.currency as string) || 'MYR', week: weeksAgo }
      byRfq.set(rfqId, b)
    }
    b.max = Math.max(b.max, price)
    if (row.quote_id === row.winning_quote_id) b.winning = price
  }

  let spend = 0
  let savings = 0
  let currency = 'MYR'
  const weekly = new Array(12).fill(0) // index 0 = 11 weeks ago … 11 = this week
  for (const b of byRfq.values()) {
    if (b.winning === null) continue
    spend += b.winning
    const saved = Math.max(0, b.max - b.winning)
    savings += saved
    currency = b.currency
    if (b.week >= 0 && b.week < 12) weekly[11 - b.week] += saved
  }
  // Cumulative for a rising sparkline.
  const savingsTrend: number[] = []
  weekly.reduce((acc, v) => {
    const next = acc + v
    savingsTrend.push(next)
    return next
  }, 0)

  // This week (trailing 7 days).
  const { rows: wk } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM rfqs r        WHERE r.created_at >= NOW() - INTERVAL '7 days' ${scope}) AS rfqs_created,
       (SELECT COUNT(*) FROM quotes q      WHERE q.created_at >= NOW() - INTERVAL '7 days') AS quotes_in,
       (SELECT COUNT(*) FROM negotiations n WHERE n.created_at >= NOW() - INTERVAL '7 days' ${companyId ? 'AND n.company_id = $1' : ''}) AS suppliers_contacted`,
    params,
  )

  return {
    spend: Math.round(spend),
    savings: Math.round(savings),
    fee: Math.round(savings * FEE_RATE),
    currency,
    decidedCount: byRfq.size,
    thisWeek: {
      rfqsCreated: Number(wk[0].rfqs_created),
      quotesIn: Number(wk[0].quotes_in),
      suppliersContacted: Number(wk[0].suppliers_contacted),
    },
    savingsTrend,
  }
}

const GATE_LABEL: Record<string, string> = {
  supplier_list: 'Approve supplier list',
  price: 'Approve price',
  winner: 'Approve winner',
}

export async function getActivity(limit = 30, companyId?: string): Promise<ActivityItem[]> {
  const negScope = companyId ? 'WHERE company_id = $1' : ''
  const params = companyId ? [companyId] : []

  const [negs, quotes, gates] = await Promise.all([
    pool.query(
      `SELECT id, supplier, product, rfq_id, created_at
         FROM negotiations ${negScope}
        ORDER BY created_at DESC LIMIT ${limit}`,
      params,
    ),
    pool.query(
      `SELECT id, supplier, price, channel, rfq_id, created_at
         FROM quotes
        ORDER BY created_at DESC LIMIT ${limit}`,
    ),
    pool.query(
      `SELECT id, gate_type, rfq_id, created_at
         FROM approval_gates
        WHERE status = 'pending'
        ORDER BY created_at DESC LIMIT ${limit}`,
    ),
  ])

  const items: ActivityItem[] = [
    ...negs.rows.map((r): ActivityItem => ({
      id: `neg-${r.id}`,
      type: 'send',
      channel: 'whatsapp',
      text: `Reached out to ${r.supplier} about ${r.product}`,
      ts: (r.created_at as Date).toISOString(),
      link: r.rfq_id ? `/rfqs/${r.rfq_id}` : null,
    })),
    ...quotes.rows.map((r): ActivityItem => ({
      id: `quote-${r.id}`,
      type: 'receive',
      channel: (r.channel as ActivityItem['channel']) ?? 'whatsapp',
      text: r.price
        ? `${r.supplier} quoted ${r.price}`
        : `${r.supplier} sent a quote`,
      ts: (r.created_at as Date).toISOString(),
      link: r.rfq_id ? `/rfqs/${r.rfq_id}` : null,
    })),
    ...gates.rows.map((r): ActivityItem => ({
      id: `gate-${r.id}`,
      type: 'approve',
      channel: 'web',
      text: `${GATE_LABEL[r.gate_type as string] ?? 'Approval'} — needs your call`,
      ts: (r.created_at as Date).toISOString(),
      link: r.rfq_id ? `/rfqs/${r.rfq_id}` : null,
    })),
  ]

  return items
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limit)
}
