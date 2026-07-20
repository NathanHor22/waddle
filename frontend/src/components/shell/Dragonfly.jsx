// Waddle mark — ported from the reference app.
export function Dragonfly({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2v20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 7C9 5 4 5.5 2 8c2 1.5 6 2 10 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 7c3-2 8-1.5 10 1-2 1.5-6 2-10 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 13c-2.5-1.5-6-1-7.5 1 1.5 1.2 5 1.5 7.5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 13c2.5-1.5 6-1 7.5 1-1.5 1.2-5 1.5-7.5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="3.5" r="1.2" fill="currentColor" />
    </svg>
  )
}
