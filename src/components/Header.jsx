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
    if (navigation?.loading) {
      return []
    }
    return FALLBACK_NAV_ITEMS
  }, [navigation?.items, navigation?.loading, contentNavItems])
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
  const getNavHref = (item) => {
    if (!item) return '#'
    if (item.target) {
      const target = item.target
      const value = target.value ?? target.path ?? target.href ?? target.slug
      switch (target.type) {
        case 'section': {
          const sectionId = resolveSectionId({ ...item, ...target })
          return sectionId ? `#${sectionId.replace(/^#/, '')}` : '#'
        }
        case 'route':
        case 'page':
          return typeof value === 'string' && value.trim()
            ? value.startsWith('/')
              ? value
              : `/${value.trim().replace(/^\//, '')}`
            : '#'
        case 'external':
        case 'href': {
          const safeUrl = sanitizeExternalUrl(value)
          return safeUrl || '#'
        }
        default:
          return '#'
      }
    }
    if (item.href) {
      const safeUrl = sanitizeExternalUrl(item.href)
      return safeUrl || '#'
    }
    if ((item.type === 'route' || item.type === 'page') && item.path) {
      return item.path
    }
    if (item.type === 'section') {
      const sectionId = resolveSectionId(item)
      return sectionId ? `#${sectionId.replace(/^#/, '')}` : '#'
    }
    if (item.slug) {
      return `/pages/${item.slug}`
    }
    return '#'
  }
  const isExternalHref = (href) =>
    typeof href === 'string' && (href.startsWith('http://') || href.startsWith('https://'))
  const isSpecialProtocol = (href) =>
    typeof href === 'string' && (href.startsWith('mailto:') || href.startsWith('tel:'))
  const handleNavClick = (event, item) => {
    if (!item) return
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.button !== 0) {
      return
    }
    event.preventDefault()
    handleNavigation(item)
    setMobileMenuOpen(false)
  }
  const handleBrandClick = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.button !== 0) {
      return
    }
    event.preventDefault()
    setMobileMenuOpen(false)
    if (location.pathname === '/') {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }
    navigate('/')
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
          <a
            href="/"
            onClick={handleBrandClick}
            className="flex items-center space-x-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            aria-label="Zur Startseite"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
              <BrandIcon className="w-6 h-6" />
            </div>
            <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {headerContent?.brand?.name || 'Linux Tutorial'}
            </span>
          </a>
          {}
          <div className="hidden md:flex items-center space-x-8">
            {computedNavItems.map((item, index) => {
              const href = getNavHref(item)
              const external = isExternalHref(href)
              const special = isSpecialProtocol(href)
              const ariaCurrent = !href || href.startsWith('#') || external || special
                ? undefined
                : location.pathname === href
                  ? 'page'
                  : undefined
              return (
                <a
                  key={item.id || `${item.label ?? 'nav'}-${index}`}
                  href={href}
                  onClick={(event) => handleNavClick(event, item)}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                  className="nav-link font-medium hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
                  aria-current={ariaCurrent}
                >
                  {item.label}
                </a>
              )
            })}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Search tutorials"
            >
              <Search className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <ThemeToggle />
            <button onClick={handleCtaClick} className="btn-primary btn-primary--compact">
              <CTAIcon className="w-4 h-4" />
              <span>{isAuthenticated ? ctaContent.authLabel || 'Admin' : ctaContent.guestLabel || 'Login'}</span>
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
              aria-label={mobileMenuOpen ? 'Navigation schließen' : 'Navigation öffnen'}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {computedNavItems.map((item, index) => {
              const href = getNavHref(item)
              const external = isExternalHref(href)
              return (
                <a
                  key={item.id || `${item.label ?? 'nav'}-${index}`}
                  href={href}
                  onClick={(event) => handleNavClick(event, item)}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                  className="block w-full text-left px-4 py-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400"
                >
                  {item.label}
                </a>
              )
            })}
            <button
              onClick={handleCtaClick}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:from-primary-700 hover:to-primary-800"
            >
              <CTAIcon className="w-4 h-4" />
              <span>{isAuthenticated ? ctaContent.authLabel || 'Admin' : ctaContent.guestLabel || 'Login'}</span>
            </button>
          </div>
        )}
      </nav>
      {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} />}
    </header>
  )
}
export default Header
