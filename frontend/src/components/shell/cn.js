// Minimal className joiner — falsy values dropped. Enough for our Tailwind
// conditionals without pulling in clsx/tailwind-merge.
export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
