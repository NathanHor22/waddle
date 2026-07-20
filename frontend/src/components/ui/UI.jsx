import { AlertCircle, CheckCircle2, Info, LoaderCircle } from 'lucide-react'
import './UI.css'

export function Button({ variant = 'primary', size = 'md', busy = false, children, className = '', ...props }) {
  return <button className={`ui-button ui-button--${variant} ui-button--${size} ${className}`} disabled={busy || props.disabled} {...props}>{busy && <LoaderCircle className="ui-button__spinner" size={14} />}{children}</button>
}

export function StatusBadge({ tone = 'neutral', children }) {
  return <span className={`ui-status ui-status--${tone}`}><span />{children}</span>
}

export function InlineAlert({ tone = 'error', children }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle
  return <div className={`ui-alert ui-alert--${tone}`} role={tone === 'error' ? 'alert' : undefined}><Icon size={15} /><div>{children}</div></div>
}

export function EmptyState({ icon: Icon, title, children }) {
  return <div className="ui-empty">{Icon && <Icon size={20} />}<strong>{title}</strong>{children && <span>{children}</span>}</div>
}
