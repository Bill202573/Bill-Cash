import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

export function Header() {
  const location = useLocation()
  const [showMenu, setShowMenu] = useState(false)

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/pacientes', label: 'Pacientes', icon: '👥' },
    { path: '/agendamentos', label: 'Agendamentos', icon: '📅' },
    { path: '/fluxo', label: 'Fluxo', icon: '⏱️' }
  ]

  return (
    <header className="bg-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold flex items-center gap-2">
            <span>🦷</span>
            <span className="hidden sm:inline">Stelle Odontologia</span>
          </Link>

          <nav className="hidden md:flex gap-6">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-lg transition ${
                  isActive(item.path)
                    ? 'bg-blue-800 font-semibold'
                    : 'hover:bg-blue-500'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            className="md:hidden p-2 hover:bg-blue-500 rounded"
            onClick={() => setShowMenu(!showMenu)}
          >
            ☰
          </button>
        </div>

        {showMenu && (
          <nav className="md:hidden mt-4 space-y-2 pb-4">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setShowMenu(false)}
                className={`block px-3 py-2 rounded-lg transition ${
                  isActive(item.path)
                    ? 'bg-blue-800 font-semibold'
                    : 'hover:bg-blue-500'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
