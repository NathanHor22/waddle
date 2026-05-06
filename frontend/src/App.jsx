import { useState } from 'react'
import { LocationProvider } from './context/LocationContext'
import { Navbar } from './components/Navbar/Navbar'
import { HeroSearch } from './components/HeroSearch/HeroSearch'
import { SessionsSidebar } from './components/SessionsSidebar/SessionsSidebar'
import './index.css'

export default function App() {
  const [activeSessionId, setActiveSessionId] = useState(null)

  function handleNewSession() {
    setActiveSessionId(null)
  }

  return (
    <LocationProvider>
      <Navbar />
      <div className="app-layout">
        <SessionsSidebar
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={handleNewSession}
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
