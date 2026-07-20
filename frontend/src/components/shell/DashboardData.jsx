import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { listRfqs, listPendingGates, getDashboardStats, getActivity } from '../../lib/rfqApi'
import { getSessions } from '../../lib/sessionsApi'

// Shared dashboard data for the shell, dashboard, and WadRail. One fetch, one
// source of truth, a single refresh(). Plain Context + useEffect — no global
// store: this is read-mostly server state for a single screen.
const DashboardDataContext = createContext(null)

const EMPTY_STATS = {
  spend: 0, savings: 0, fee: 0, currency: 'MYR', decidedCount: 0,
  thisWeek: { rfqsCreated: 0, quotesIn: 0, suppliersContacted: 0 },
  savingsTrend: [],
}

export function DashboardDataProvider({ children }) {
  const [rfqs, setRfqs] = useState([])
  const [gates, setGates] = useState([])
  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState(EMPTY_STATS)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    // Settled (not all) so one failing source — e.g. sessions needing auth —
    // never blanks the whole hub.
    const [r, g, s, st, ac] = await Promise.allSettled([
      listRfqs(), listPendingGates(), getSessions(), getDashboardStats(), getActivity(),
    ])
    if (r.status === 'fulfilled') setRfqs(r.value)
    else setError(r.reason?.message ?? 'Failed to load RFQs')
    if (g.status === 'fulfilled') setGates(g.value)
    if (s.status === 'fulfilled') setSessions(s.value)
    if (st.status === 'fulfilled') setStats(st.value)
    if (ac.status === 'fulfilled') setActivity(ac.value)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const value = { rfqs, gates, sessions, stats, activity, loading, error, refresh }
  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) throw new Error('useDashboardData must be used within DashboardDataProvider')
  return ctx
}
