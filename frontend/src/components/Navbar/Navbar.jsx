import { LocationSwitcher } from './LocationSwitcher'
import './Navbar.css'

export function Navbar() {
  return (
    <header className="navbar">
      <LocationSwitcher />
    </header>
  )
}
