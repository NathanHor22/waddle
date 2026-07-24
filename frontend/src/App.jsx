import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { ChatApp } from './pages/ChatApp'
import { WaddleForMe } from './pages/WaddleForMe'
import { Dashboard } from './pages/Dashboard'
import { AppShell } from './components/shell/AppShell'
import { DashboardDataProvider } from './components/shell/DashboardData'
import { RfqDetail } from './pages/RfqDetail'
import { Connections } from './pages/Connections'
import { Onboarding } from './pages/Onboarding'
import { getMe } from './lib/authApi'
import './index.css'

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  const refreshUser = () =>
    getMe().then(setUser).catch(() => setUser(null)).finally(() => setAuthChecked(true))

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      localStorage.setItem('waddle_token', token)
      window.history.replaceState({}, '', window.location.pathname)
    }

    refreshUser()
  }, [])

  function handleSignIn() {
    const base = import.meta.env.VITE_API_BASE_URL ?? ''
    window.location.href = `${base}/api/auth/google`
  }

  function handleSignOut() {
    localStorage.removeItem('waddle_token')
    setUser(null)
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage user={user} onSignIn={handleSignIn} />}
      />
      <Route
        path="/app"
        element={
          <DashboardDataProvider>
            <AppShell user={user} onSignOut={handleSignOut}>
              <ChatApp user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />
            </AppShell>
          </DashboardDataProvider>
        }
      />
      <Route
        path="/waddle-for-me"
        element={<WaddleForMe user={user} onSignIn={handleSignIn} />}
      />
      <Route path="/onboarding" element={<Onboarding user={user} refreshUser={refreshUser} />} />
      <Route
        path="/rfqs"
        element={
          !authChecked ? <div className="app-loading">Loading…</div>
            : user && !user.companyId ? <Navigate to="/onboarding" replace />
            : (
              <DashboardDataProvider>
                <AppShell user={user} onSignOut={handleSignOut}>
                  <Dashboard user={user} />
                </AppShell>
              </DashboardDataProvider>
            )
        }
      />
      <Route
        path="/connections"
        element={
          !authChecked ? <div className="app-loading">Loading…</div>
            : user && !user.companyId ? <Navigate to="/onboarding" replace />
            : (
              <DashboardDataProvider>
                <AppShell user={user} onSignOut={handleSignOut}>
                  <Connections />
                </AppShell>
              </DashboardDataProvider>
            )
        }
      />
      <Route
        path="/rfqs/:id"
        element={
          !authChecked ? <div className="app-loading">Loading…</div>
            : user && !user.companyId ? <Navigate to="/onboarding" replace />
            : (
              <DashboardDataProvider>
                <AppShell user={user} onSignOut={handleSignOut}>
                  <RfqDetail user={user} />
                </AppShell>
              </DashboardDataProvider>
            )
        }
      />
    </Routes>
  )
}
