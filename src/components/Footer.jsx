import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Terminal, Heart } from 'lucide-react'
import { useContent } from '../context/ContentContext'
import { navigateContentTarget } from '../utils/contentNavigation'
import { getIconComponent } from '../utils/iconMap'
import { sanitizeExternalUrl } from '../utils/urlValidation'

/**
 * Resolves the appropriate icon for a contact link based on its properties.
 *
 * This utility function determines the most suitable icon for a contact link
 * by analyzing its label, URL, and explicit icon settings. It provides intelligent
 * fallbacks to ensure consistent visual representation across different contact types.
 *
 * Resolution Logic:
 * 1. Uses explicitly specified icon if provided
 * 2. Falls back to label-based detection (mail, git, etc.)
 * 3. Analyzes URL patterns for automatic icon selection
 * 4. Defaults to 'Terminal' icon for unknown types
 *
 * Pattern Matching:
 * - Email: 'mail' in label or 'mailto:' in URL
 * - GitHub: 'git' in label or 'github' in URL
 * - Default: Terminal icon for general/unknown contacts
 *
 * Security Considerations:
 * - Uses sanitized URLs for pattern matching
 * - Handles missing or malformed URL data gracefully
 * - Prevents errors when contact data is incomplete
 *
 * @function
 * @param {Object} contact - Contact link object containing icon, label, and URL information
 * @param {string} [contact.icon] - Explicit icon name to override automatic detection
 * @param {string} [contact.label] - Contact label text used for pattern matching
 * @param {string} [contact.href] - Contact URL used for pattern matching
 * @param {string} [contact.url] - Alternative URL field name
 *
 * @returns {string} Icon name to use for the contact (e.g., 'Mail', 'Github', 'Terminal')
 *
 * @example
 * // Automatic email detection
 * resolveContactFallbackIcon({ label: 'Contact Email', href: 'mailto:test@example.com' })
 * // Returns: 'Mail'
 *
 * // Explicit icon override
 * resolveContactFallbackIcon({ icon: 'CustomIcon', label: 'Support' })
 * // Returns: 'CustomIcon'
 *
 * // GitHub URL detection
 * resolveContactFallbackIcon({ href: 'https://github.com/user' })
 * // Returns: 'Github'
 *
 * @see {@link ../utils/urlValidation.js} for URL sanitization
 * @see {@link ../utils/iconMap.js} for icon component mapping
 */

/**
 * Footer component displaying brand information, navigation links, and contact details.
 *
 * This component renders a comprehensive site footer with dynamic content management
 * capabilities. It pulls content from the CMS and provides intelligent navigation
 * handling for different types of links and targets.
 *
 * Key Features:
 * - Dynamic brand information from CMS content
 * - Intelligent navigation link generation from multiple sources
 * - Contact link handling with security validation
 * - Automatic current year for copyright notices
 * - Responsive design with mobile-first approach
 * - Multiple navigation sources (static, dynamic, CMS-driven)
 *
 * Content Sources:
 * - CMS footer section for brand and contact information
 * - Navigation context for quick links and site structure
 * - Fallback content when CMS data is unavailable
 *
 * Navigation Handling:
 * - Internal route navigation with React Router
 * - External link opening in new tabs with security attributes
 * - Anchor link smooth scrolling to page sections
 * - Email and telephone link handling
 *
 * Security Features:
 * - URL sanitization for all external links
 * - Security attributes (rel="noopener noreferrer") for external links
 * - Validation of link targets before navigation
 * - Safe handling of malformed URLs
 *
 * Performance Optimization:
 * - Memoized computed values to prevent unnecessary recalculations
 * - Efficient link resolution logic
 * - Minimal re-renders through proper dependency management
 *
 * @component
 * @example
 * // Basic usage (automatically pulls content from CMS)
 * <Footer />
 *
 * @returns {JSX.Element} Rendered footer with brand information, quick links, and contact details
 *
 * @see {@link ../context/ContentContext.jsx} for CMS content management
 * @see {@link ../utils/contentNavigation.js} for navigation handling utilities
 * @see {@link ../utils/urlValidation.js} for URL security validation
 */
const Footer = () => {
  const { getSection, navigation } = useContent()
  const footerContent = getSection('footer') ?? {}
  const currentYear = new Date().getFullYear()
  const navigate = useNavigate()
  const location = useLocation()

  const BrandIcon = useMemo(
    () => getIconComponent(footerContent?.brand?.icon, 'Terminal'),
    [footerContent?.brand?.icon],
  )

  const contactLinks = Array.isArray(footerContent?.contactLinks) ? footerContent.contactLinks : []

  const staticNavigationItems = useMemo(
    () => (Array.isArray(navigation?.static) ? navigation.static : []),
    [navigation?.static],
  )

  const dynamicNavigationItems = useMemo(
    () => (Array.isArray(navigation?.dynamic) ? navigation.dynamic : []),
    [navigation?.dynamic],
  )

  const effectiveNavigationItems = useMemo(() => {
    const combined = [...staticNavigationItems, ...dynamicNavigationItems]
    if (combined.length > 0) {
      return combined
    }

    const allItems = Array.isArray(navigation?.items) ? navigation.items : []
    return allItems
  }, [staticNavigationItems, dynamicNavigationItems, navigation?.items])

  const navigationQuickLinks = useMemo(() => {
    const items = effectiveNavigationItems

    return items
      .map((item) => {
        if (!item) return null

        if (item.target) {
          return {
            label: item.label || item.slug || 'Link',
            target: item.target,
          }
        }

        if (item.href) {
          const safeHref = sanitizeExternalUrl(item.href)
          if (!safeHref) {
            console.warn('Blocked unsafe navigation href in footer:', item.href)
            return null
          }
          return {
            label: item.label || item.slug || item.href,
            href: safeHref,
          }
        }

        if (item.type === 'route' && item.path) {
          return {
            label: item.label || item.slug || item.path,
            target: { type: 'route', value: item.path },
          }
        }

        if (item.type === 'section') {
          const sectionValue = item.path || item.value || item.id
          if (!sectionValue) return null
          return {
            label: item.label || 'Link',
            target: { type: 'section', value: sectionValue },
          }
        }

        if (item.slug) {
          return {
            label: item.label || item.slug,
            target: { type: 'route', value: `/pages/${item.slug}` },
          }
        }

        return null
      })
      .filter(Boolean)
  }, [effectiveNavigationItems])

  const quickLinks = useMemo(() => {
    return navigationQuickLinks
  }, [navigationQuickLinks])

  
  /**
   * Handles navigation when a quick link is clicked.
   *
   * This function provides intelligent navigation handling for different types of links
   * that may appear in the footer. It supports content targets, external URLs, email/phone
   * links, and internal routes with proper security measures.
   *
   * Navigation Priority:
   * 1. Content targets (CMS-driven navigation)
   * 2. External URLs (HTTP/HTTPS links)
   * 3. Special protocols (mailto:, tel:)
   * 4. Internal routes (React Router navigation)
   *
   * Security Features:
   * - URL sanitization for all external links
   * - Security attributes for external links (noopener, noreferrer)
   * - Safe opening of external links in new tabs
   * - Server-side rendering compatibility checks
   *
   * Protocol Handling:
   * - HTTP/HTTPS: Opens in new tab with security attributes
   * - mailto: Opens default email client
   * - tel: Opens default phone app (mobile)
   * - Relative paths: Internal navigation with React Router
   *
   * Error Handling:
   * - Graceful handling of malformed link data
   * - Safe fallbacks for missing properties
   * - Server-side rendering compatibility
   *
   * @function
   * @param {Object} link - Link object containing navigation information
   * @param {Object} [link.target] - Content target object for CMS navigation
   * @param {string} [link.href] - URL for external or special protocol links
   * @param {string} [link.url] - Alternative URL field name
   * @param {string} [link.path] - Internal route path for React Router
   *
   * @returns {void} No return value - performs navigation action
   *
   * @example
   * // Content target navigation
   * handleQuickLink({ target: { type: 'route', value: '/about' } })
   * // Navigates to /about route
   *
   * // External link
   * handleQuickLink({ href: 'https://example.com' })
   * // Opens example.com in new tab
   *
   * // Email link
   * handleQuickLink({ href: 'mailto:contact@example.com' })
   * // Opens email client
   *
   * @see {@link ../utils/contentNavigation.js} for content target navigation
   * @see {@link ../utils/urlValidation.js} for URL security validation
   */
  const handleQuickLink = (link) => {
    // Early return for invalid or missing link data
    if (!link) return

    // Extract navigation data from link object
    const target = link.target
    const href = sanitizeExternalUrl(link.href || link.url)
    const path = link.path

    // Priority 1: Content targets (CMS-driven navigation)
    if (target) {
      navigateContentTarget(target, { navigate, location })
      return
    }

    // Priority 2: External URLs and special protocols
    if (href) {
      // Ensure we're in a browser environment
      if (typeof window === 'undefined') {
        return
      }

      // External HTTP/HTTPS links - open in new tab with security
      if (href.startsWith('http://') || href.startsWith('https://')) {
        window.open(href, '_blank', 'noopener,noreferrer')
        return
      }

      // Special protocol links (email, phone) - use current window
      if (href.startsWith('mailto:') || href.startsWith('tel:')) {
        window.location.href = href
        return
      }

      // Other relative URLs - navigate in current window
      window.location.assign(href)
      return
    }

    // Priority 3: Internal routes - use React Router
    if (path) {
      navigate(path)
      return
    }
  }

  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gradient-to-r from-primary-600 to-primary-800 p-2 rounded-lg">
                <BrandIcon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">
                {footerContent?.brand?.title || footerContent?.brand?.name || 'Linux Tutorial'}
              </span>
            </div>
            <p className="text-gray-400">
              {footerContent?.brand?.description ||
                'Dein umfassendes Tutorial für Linux - von den Basics bis zu Advanced Techniken.'}
            </p>
          </div>

          {}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.length > 0 ? (
                quickLinks.map((link, index) => (
                  <li key={link.label || link.target?.value || `quick-${index}`}>
                    <button
                      onClick={() => handleQuickLink(link)}
                      className="hover:text-primary-400 transition-colors duration-200"
                    >
                      {link.label || 'Link'}
                    </button>
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500">Noch keine Quick Links definiert.</li>
              )}
            </ul>
          </div>

          {}
          <div>
            <h4 className="text-white font-semibold mb-4">Kontakt</h4>
            <div className="space-y-3">
              {contactLinks.length > 0 ? (
                contactLinks.map((contact, index) => {
                  const safeHref = sanitizeExternalUrl(contact.href || contact.url)
                  const ContactIcon = getIconComponent(resolveContactFallbackIcon(contact), 'Terminal')

                  if (!safeHref) {
                    return (
                      <div
                        key={contact.label || `contact-${index}`}
                        className="flex items-center space-x-2 text-gray-500"
                      >
                        <ContactIcon className="w-5 h-5" />
                        <span>{contact.label || 'Kontakt'}</span>
                      </div>
                    )
                  }

                  const isHttp = safeHref.startsWith('http://') || safeHref.startsWith('https://')
                  const isExternal = isHttp

                  return (
                    <a
                      key={safeHref || contact.label || `contact-${index}`}
                      href={safeHref}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      className="flex items-center space-x-2 hover:text-primary-400 transition-colors duration-200"
                    >
                      <ContactIcon className="w-5 h-5" />
                      <span>{contact.label || safeHref || 'Kontakt'}</span>
                    </a>
                  )
                })
              ) : (
                <p className="text-sm text-gray-500">Keine Kontaktlinks verfügbar.</p>
              )}
            </div>
          </div>
        </div>

        {}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm mb-4 md:mb-0">
            {(footerContent?.bottom?.copyright || '© {year} Linux Tutorial. Alle Rechte vorbehalten.').replace(
              '{year}',
              currentYear,
            )}
          </p>
          {footerContent?.bottom?.signature ? (
            <p className="text-gray-400 text-sm text-center md:text-right">
              {footerContent.bottom.signature.replace('{year}', currentYear)}
            </p>
          ) : (
            <div className="flex items-center space-x-1 text-sm">
              <span className="text-gray-400">Gemacht mit</span>
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              <span className="text-gray-400">für die Linux Community</span>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}

export default Footer
