import { useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FilePlus2, Search, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { captureRfq } from '../lib/rfqApi'
import { useDashboardData } from '../components/shell/DashboardData'
import { EmptyState, StatusBadge } from '../components/ui/UI'

const STATUS = {
  draft: 'Draft',
  out_for_quotes: 'Collecting quotes',
  quotes_in: 'Quotes received',
  negotiating: 'Negotiating',
  awaiting_approval: 'Needs approval',
  decided: 'Decision recorded',
  closed: 'Closed',
}
const GATES = { supplier_list: 'Supplier list', price: 'Negotiated price', winner: 'Winning supplier' }
const ACTIVE = new Set(['draft', 'out_for_quotes', 'quotes_in', 'negotiating', 'awaiting_approval'])

export function Dashboard({ user }) {
  const navigate = useNavigate()
  const { rfqs, gates, activity, stats, loading, error, refresh } = useDashboardData()
  const [query, setQuery] = useState('')
  const [request, setRequest] = useState('')
  const [captureState, setCaptureState] = useState({ busy: false, error: '', questions: [] })

  const active = rfqs.filter((r) => ACTIVE.has(r.status))
  const awaiting = active.filter((r) => r.status === 'awaiting_approval')
  const filtered = active.filter((r) => {
    const q = query.trim().toLowerCase()
    return !q || [r.product, r.grade, r.quantity, r.deliveryLocation, STATUS[r.status]].some((v) => v?.toLowerCase?.().includes(q))
  })

  async function createRequest() {
    if (!request.trim() || captureState.busy) return
    setCaptureState({ busy: true, error: '', questions: [] })
    try {
      const result = await captureRfq(request.trim())
      if (!result.rfq) {
        setCaptureState({ busy: false, error: '', questions: result.clarifyingQuestions ?? [] })
        return
      }
      navigate(`/rfqs/${result.rfq.id}`)
    } catch (err) {
      setCaptureState({ busy: false, error: err.message, questions: [] })
    }
  }

  return (
    <div className="work-queue">
      <div className="page-heading">
        <div>
          <p className="page-kicker">Work queue</p>
          <h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {(user?.name || 'there').split(' ')[0]}</h1>
          <p className="page-summary">{gates.length ? `${gates.length} decision${gates.length === 1 ? '' : 's'} need your attention.` : 'Nothing is waiting for your approval right now.'}</p>
        </div>
        <button className="secondary-button" onClick={refresh} disabled={loading}>Refresh queue</button>
      </div>

      {error && <div className="inline-alert inline-alert--error"><AlertCircle size={16} /> {error}</div>}

      <section className="queue-grid">
        <div className="queue-main">
          <section className="workspace-card request-card">
            <div className="card-heading"><div><span className="card-icon"><FilePlus2 size={16} /></span><div><h2>Start a procurement request</h2><p>Describe the item, quantity, destination, and deadline. Wad will structure the request for review.</p></div></div></div>
            <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={3} placeholder="Example: 200L of 12% sodium hypochlorite delivered to Shah Alam by next Friday, target price RM4,000" />
            {captureState.questions.length > 0 && <div className="inline-alert inline-alert--warning"><Sparkles size={16} /><div><strong>A few details are needed before sourcing:</strong><ul>{captureState.questions.map((q, i) => <li key={i}>{q}</li>)}</ul></div></div>}
            {captureState.error && <div className="inline-alert inline-alert--error"><AlertCircle size={16} /> {captureState.error}</div>}
            <div className="card-actions"><button className="primary-button" disabled={!request.trim() || captureState.busy} onClick={createRequest}>{captureState.busy ? 'Structuring request…' : 'Review request'} <ArrowRight size={15} /></button></div>
          </section>

          {gates.length > 0 && <section className="workspace-card attention-card"><div className="section-heading"><div><p className="card-kicker">Needs your attention</p><h2>Pending decisions</h2></div><span className="count-badge">{gates.length}</span></div><div className="decision-list">{gates.map((gate) => { const rfq = rfqs.find((r) => r.id === gate.rfqId); return <button className="decision-row" key={gate.id} onClick={() => gate.rfqId && navigate(`/rfqs/${gate.rfqId}`)}><span className="decision-mark"><AlertCircle size={15} /></span><span className="decision-copy"><strong>{GATES[gate.gateType] ?? 'Procurement decision'}</strong><small>{rfq?.product ?? 'RFQ'} · Review evidence and decide</small></span><ArrowRight size={16} /></button> })}</div></section>}

          <section className="workspace-card"><div className="section-heading"><div><p className="card-kicker">Active work</p><h2>Procurement requests in progress</h2></div><div className="queue-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requests" /></div></div>{loading && <EmptyState title="Loading your work queue…" />}{!loading && filtered.length === 0 && <EmptyState icon={CheckCircle2} title={active.length ? 'No requests match that search.' : 'No active requests yet.'}>{active.length ? 'Try a product, status, or delivery location.' : 'Start with a procurement request above.'}</EmptyState>}{filtered.length > 0 && <div className="request-list">{filtered.map((rfq) => <button className="request-row" key={rfq.id} onClick={() => navigate(`/rfqs/${rfq.id}`)}><StatusBadge tone={rfq.status === 'awaiting_approval' ? 'warning' : rfq.status === 'draft' ? 'neutral' : 'success'} /><span className="request-copy"><strong>{rfq.product}{rfq.grade ? ` · ${rfq.grade}` : ''}</strong><small>{rfq.quantity || 'Quantity not set'} · {rfq.deliveryLocation || 'Delivery location not set'}</small></span><span className="request-stage"><em>{STATUS[rfq.status] ?? rfq.status}</em><small>{rfq.contactedCount ?? 0} contacted · {rfq.quoteCount ?? 0} quotes</small></span><ArrowRight size={16} /></button>)}</div>}</section>
        </div>

        <aside className="queue-side">
          <section className="workspace-card"><div className="section-heading"><div><p className="card-kicker">At a glance</p><h2>Today’s workload</h2></div></div><div className="metric-list"><div><span>Needs approval</span><strong>{gates.length}</strong></div><div><span>Active requests</span><strong>{active.length}</strong></div><div><span>Quotes received</span><strong>{stats.thisWeek?.quotesIn ?? 0}</strong></div></div></section>
          <section className="workspace-card"><div className="section-heading"><div><p className="card-kicker">Current activity</p><h2>What is happening</h2></div></div>{activity.length === 0 ? <div className="empty-state empty-state--small"><Clock3 size={18} /><span>Wad’s supplier and workflow activity will appear here.</span></div> : <div className="activity-list">{activity.slice(0, 6).map((item) => <div className="activity-row" key={item.id}><span className="activity-dot" /><div><strong>{item.text}</strong><small>{item.ts ? new Date(item.ts).toLocaleString() : 'Recent activity'}</small></div></div>)}</div>}</section>
          {awaiting.length > 0 && <section className="next-action"><p className="card-kicker">Recommended next step</p><h2>Review the waiting decisions</h2><p>{awaiting.length} request{awaiting.length === 1 ? ' is' : 's are'} ready for your judgement.</p><button className="text-button" onClick={() => navigate(`/rfqs/${awaiting[0].id}`)}>Open first decision <ArrowRight size={15} /></button></section>}
        </aside>
      </section>
    </div>
  )
}
