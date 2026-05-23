import { useState, useEffect } from 'react'
import { LocationProvider } from './context/LocationContext'
import { Navbar } from './components/Navbar/Navbar'
import { HeroSearch } from './components/HeroSearch/HeroSearch'
import { SessionsSidebar } from './components/SessionsSidebar/SessionsSidebar'
import { getMe } from './lib/authApi'
import './index.css'

export default function App() {
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [user, setUser] = useState(null)

  // Restore auth on mount and handle /auth/callback token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      localStorage.setItem('waddle_token', token)
      window.history.replaceState({}, '', '/')
    }

    getMe()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  function handleNewSession() {
    setActiveSessionId(null)
  }

  function handleSignIn() {
    window.location.href = '/api/auth/google'
  }

  function handleSignOut() {
    localStorage.removeItem('waddle_token')
    setUser(null)
  }

  return (
    <LocationProvider>
      <Navbar
        onLogoClick={handleNewSession}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
      <div className="app-layout">
        <SessionsSidebar
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={handleNewSession}
          user={user}
          onSignIn={handleSignIn}
        />
        <main className="app-main">
          <HeroSearch
            sessionId={activeSessionId}
            onSessionCreated={setActiveSessionId}
          />
        </main>
      </div>
    </LocationProvider>
  )
}
