import { useState } from 'react'
import './CollapsibleSection.css'

// A titled section that remembers whether the user left it open or closed.
// `id` keys the persisted state in localStorage, so each section is independent.
export function CollapsibleSection({ id, title, count, defaultOpen = true, children }) {
  const storageKey = `waddle_section_${id}`
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return saved === null ? defaultOpen : saved === '1'
  })

  function toggle() {
    setOpen((prev) => {
      const next = !prev
      localStorage.setItem(storageKey, next ? '1' : '0')
      return next
    })
  }

  return (
    <section className="csec">
      <button className="csec__head" onClick={toggle} aria-expanded={open}>
        <span className={`csec__caret ${open ? 'csec__caret--open' : ''}`} aria-hidden="true">▸</span>
        <span className="csec__title">{title}</span>
        {count != null && <span className="csec__count">{count}</span>}
      </button>
      {open && <div className="csec__body">{children}</div>}
    </section>
  )
}
