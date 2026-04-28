import { LocationProvider } from './context/LocationContext'
import { Navbar } from './components/Navbar/Navbar'
import { HeroSearch } from './components/HeroSearch/HeroSearch'
import './index.css'

export default function App() {
  return (
    <LocationProvider>
      <Navbar />
      <HeroSearch />
    </LocationProvider>
  )
}
