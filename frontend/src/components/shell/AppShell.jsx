import { Sidebar } from './Sidebar'

// Three-pane shell for the dashboard: Sidebar ‖ content ‖ WadRail.
// Wraps only the /rfqs route; the rest of the app keeps its own chrome.
export function AppShell({ user, onSignOut, children }) {
  return (
    <div className="app-shell">
      <Sidebar user={user} onSignOut={onSignOut} />
      <main className="app-shell__main">
        <header className="app-shell__header">
          <div>
            <p className="app-shell__eyebrow">Procurement workspace</p>
            <p className="app-shell__context">Decisions, supplier activity, and approvals in one place</p>
          </div>
          <div className="app-shell__status"><span /> System operational</div>
        </header>
        <div className="app-shell__content">{children}</div>
      </main>
    </div>
  )
}
