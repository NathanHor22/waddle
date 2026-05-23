import { useState } from 'react'
import { LocationProvider } from '../context/LocationContext'
import { Navbar } from '../components/Navbar/Navbar'
import { HeroSearch } from '../components/HeroSearch/HeroSearch'
import { SessionsSidebar } from '../components/SessionsSidebar/SessionsSidebar'

export function ChatApp({ user, onSignIn, onSignOut }) {
  const [activeSessionId, setActiveSessionId] = useState(null)

  function handleNewSession() {
    setActiveSessionId(null)
  }

  return (
    <LocationProvider>
      <Navbar
        onLogoClick={handleNewSession}
        user={user}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
      />
      <div className="app-layout">
        <SessionsSidebar
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={handleNewSession}
          user={user}
          onSignIn={onSignIn}
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
