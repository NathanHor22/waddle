import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LocationProvider } from '../context/LocationContext'
import { HeroSearch } from '../components/HeroSearch/HeroSearch'
import { SessionsSidebar } from '../components/SessionsSidebar/SessionsSidebar'

export function ChatApp({ user, onSignIn, onSignOut }) {
  const [searchParams] = useSearchParams()
  // Deep-link from the dashboard's Chat history → open that conversation.
  const [activeSessionId, setActiveSessionId] = useState(() => searchParams.get('session'))

  function handleNewSession() { setActiveSessionId(null) }

  return (
    <LocationProvider>
      <div className="workspace-page-heading">
        <div><p className="page-kicker">Supplier search</p><h1>Find and compare suppliers</h1><p className="page-summary">Use natural language to find relevant suppliers, then bring the result into an RFQ workflow.</p></div>
      </div>
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
