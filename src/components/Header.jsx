import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useContent } from '../context/ContentContext'
import { getIconComponent } from '../utils/iconMap'
import { navigateContentTarget } from '../utils/contentNavigation'
import { scrollToSection } from '../utils/scrollToSection'
import { sanitizeExternalUrl } from '../utils/urlValidation'
import ThemeToggle from './ThemeToggle'
import SearchBar from './SearchBar'
const FALLBACK_NAV_ITEMS = [
  { id: 'home', label: 'Home', type: 'section' },
  { id: 'grundlagen', label: 'Grundlagen', type: 'route', path: '/grundlagen' },
]
const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const { getSection, navigation } = useContent()
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
  const computedNavItems = useMemo(() => {
    if (navigation?.items?.length) {
      return navigation.items
    }
    if (contentNavItems.length > 0) {
      return contentNavItems
    }
    return FALLBACK_NAV_ITEMS
  }, [navigation?.items, contentNavItems])
  const handleNavigation = (item) => {
    if (!item) return
    if (item.target) {
      navigateContentTarget(item.target, { navigate, location })
      return
    }
    if (item.href && typeof window !== 'undefined') {
      const safeUrl = sanitizeExternalUrl(item.href)
      if (!safeUrl) {
        console.warn('Blocked unsafe navigation URL:', item.href)
        return
      }
      if (safeUrl.startsWith('http://') || safeUrl.startsWith('https://')) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer')
        return
      }
      if (safeUrl.startsWith('mailto:') || safeUrl.startsWith('tel:')) {
        window.location.href = safeUrl
        return
      }
      window.location.assign(safeUrl)
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
        return
      }
      scrollToSection(sectionId)
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
    <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-soft sticky top-0 z-50 border-b border-gray-100/50 dark:border-gray-800/50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {}
          <div className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-800 p-2.5 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
              <div className="relative bg-gradient-to-r from-primary-600 to-primary-800 p-2.5 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <BrandIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              {headerContent?.brand?.name || 'Linux Tutorial'}
            </span>
          </div>
          {}
          <div className="hidden md:flex items-center space-x-8">
            {computedNavItems.map((item, index) => (
              <button
                key={item.id || `${item.label ?? 'nav'}-${index}`}
                onClick={() => handleNavigation(item)}
                className="nav-link font-medium hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Search tutorials"
            >
              <Search className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <ThemeToggle />
            <button
              onClick={handleCtaClick}
              className="relative flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-medium shadow-lg hover:shadow-2xl hover:scale-105 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group/btn"
            >
              <CTAIcon className="w-4 h-4 group-hover/btn:rotate-12 transition-transform duration-300" />
              <span>{isAuthenticated ? ctaContent.authLabel || 'Admin' : ctaContent.guestLabel || 'Login'}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
          {}
          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Search tutorials"
            >
              <Search className="w-5 h-5" />
            </button>
            <ThemeToggle />
            <button
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {computedNavItems.map((item, index) => (
              <button
                key={item.id || `${item.label ?? 'nav'}-${index}`}
                onClick={() => {
                  handleNavigation(item)
                  setMobileMenuOpen(false)
                }}
                className="block w-full text-left px-4 py-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400"
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
      {}
      {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} />}
    </header>
  )
}
export default Header
