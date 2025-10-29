import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useContent } from '../context/ContentContext'
import { getIconComponent } from '../utils/iconMap'
import { navigateContentTarget } from '../utils/contentNavigation'
import { scrollToSection } from '../utils/scrollToSection'

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const { getSection } = useContent()

  const headerContent = getSection('header') ?? {}
  const contentNavItems = Array.isArray(headerContent.navItems) ? headerContent.navItems : []
  const BrandIcon = getIconComponent(headerContent?.brand?.icon, 'Terminal')
  const ctaContent = headerContent?.cta ?? {}
  const CTAIcon = getIconComponent(ctaContent.icon, 'Lock')

  const resolveSectionId = (item) => {
    if (!item) return null
    if (item.target?.type === 'section') return item.target.value
    if (typeof item.value === 'string') return item.value
    if (typeof item.id === 'string') return item.id
    return null
  }

  const fallbackNavItems = [
    { id: 'home', label: 'Home', type: 'section' },
    { id: 'grundlagen', label: 'Grundlagen', type: 'route', path: '/grundlagen' },
    { id: 'befehle', label: 'Befehle', type: 'section' },
    { id: 'praxis', label: 'Praxis', type: 'section' },
    { id: 'advanced', label: 'Advanced', type: 'section' },
  ]

  const computedNavItems = contentNavItems.length > 0 ? contentNavItems : fallbackNavItems

  const handleNavigation = (item) => {
    if (!item) return

    if (item.target) {
      navigateContentTarget(item.target, { navigate, location })
      return
    }

    if (item.href && typeof window !== 'undefined') {
      window.open(item.href, '_blank', 'noopener,noreferrer')
      return
    }

    const type = item.type || 'section'
    if (type === 'route' && item.path) {
      navigate(item.path)
      return
    }

    if (type === 'section') {
      const sectionId = resolveSectionId(item)
      if (!sectionId) return

      if (location.pathname !== '/') {
        navigate('/', { state: { scrollTo: sectionId } })
      } else {
        scrollToSection(sectionId)
      }
    }
  }

  const handleCtaClick = () => {
    if (ctaContent.target) {
      navigateContentTarget(ctaContent.target, { navigate, location })
      return
    }

    navigate(isAuthenticated ? '/admin' : '/login')
  }

  return (
    <header className="bg-white/80 backdrop-blur-xl shadow-soft sticky top-0 z-50 border-b border-gray-100/50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-18">
          {/* Logo */}
          <div className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-800 p-2.5 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
              <div className="relative bg-gradient-to-r from-primary-600 to-primary-800 p-2.5 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <BrandIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              {headerContent?.brand?.name || 'Linux Tutorial'}
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {computedNavItems.map((item) => (
              <button
                key={item.id || item.label}
                onClick={() => handleNavigation(item)}
                className="nav-link font-medium hover:text-primary-600"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={handleCtaClick}
              className="relative flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-medium shadow-lg hover:shadow-2xl hover:scale-105 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group/btn"
            >
              <CTAIcon className="w-4 h-4 group-hover/btn:rotate-12 transition-transform duration-300" />
              <span>{isAuthenticated ? ctaContent.authLabel || 'Admin' : ctaContent.guestLabel || 'Login'}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {computedNavItems.map((item) => (
              <button
                key={item.id || item.label}
                onClick={() => {
                  handleNavigation(item)
                  setMobileMenuOpen(false)
                }}
                className="block w-full text-left px-4 py-2 rounded-md text-gray-600 hover:bg-gray-50 hover:text-primary-600"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                handleCtaClick()
                setMobileMenuOpen(false)
              }}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200"
            >
              <CTAIcon className="w-4 h-4" />
              <span>{isAuthenticated ? ctaContent.authLabel || 'Admin' : ctaContent.guestLabel || 'Login'}</span>
            </button>
          </div>
        )}
      </nav>
    </header>
  )
}

export default Header
