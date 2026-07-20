import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ClipboardList, Search, ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react'
import { Dragonfly } from './Dragonfly'
import { cn } from './cn'

// Real routes only — no dead links. More land here as pages ship.
const nav = [
  { to: '/rfqs', label: 'Work queue', icon: ClipboardList, end: true },
  { to: '/app', label: 'Supplier search', icon: Search },
]

export function Sidebar({ user, onSignOut }) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const initial = (user?.name || user?.email || 'You').trim().charAt(0).toUpperCase()

  return (
    <aside
      className={cn(
        'app-sidebar flex flex-col border-r border-border bg-[var(--color-surface)] shrink-0 transition-all',
        collapsed ? 'w-16' : 'w-[220px]',
      )}
    >
      <div className="sidebar-brand">
        <span className="sidebar-brand__mark"><Dragonfly className="h-6 w-6" /></span>
        {!collapsed && <span className="sidebar-brand__name">Waddle</span>}
      </div>

      <nav className="sidebar-nav">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'sidebar-nav__item flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                collapsed && 'justify-center px-0',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && user && (
          <div className="sidebar-profile">
            <div className="sidebar-profile__avatar">
              {initial}
            </div>
            <div className="sidebar-profile__details">
              <div>{user.name || 'You'}</div>
              <div>{user.email}</div>
            </div>
          </div>
        )}
        {onSignOut && (
          <button
            onClick={() => setConfirmingSignOut(true)}
            className={cn(
              'sidebar-footer__action w-full flex items-center gap-2.5 rounded-md text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className={cn(
            'sidebar-footer__action w-full flex items-center gap-2 rounded-md text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : (<><ChevronsLeft className="h-4 w-4" /><span>Collapse</span></>)}
        </button>
      </div>

      {confirmingSignOut && (
        <div className="signout-modal__overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmingSignOut(false) }}>
          <div className="signout-modal" role="dialog" aria-modal="true" aria-labelledby="signout-title">
            <div className="signout-modal__icon"><LogOut size={16} /></div>
            <h2 id="signout-title">Are you sure you want to sign out?</h2>
            <p>Your active procurement work will remain saved, but you will return to the Waddle main page.</p>
            <div className="signout-modal__actions">
              <button className="signout-modal__no" onClick={() => setConfirmingSignOut(false)}>No, stay here</button>
              <button className="signout-modal__yes" onClick={() => { onSignOut(); navigate('/'); }}>Yes, sign out</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
