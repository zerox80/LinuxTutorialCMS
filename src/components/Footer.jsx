import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Terminal, Heart } from 'lucide-react'
import { useContent } from '../context/ContentContext'
import { navigateContentTarget } from '../utils/contentNavigation'
import { getIconComponent } from '../utils/iconMap'
import { sanitizeExternalUrl } from '../utils/urlValidation'

const resolveContactFallbackIcon = (contact) => {
  const label = (contact?.label || '').toLowerCase()
  const rawHref = contact?.href || contact?.url || ''
  const safeHref = sanitizeExternalUrl(rawHref) || ''
  const href = safeHref.toLowerCase()

  if (contact?.icon) {
    return contact.icon
  }
  if (label.includes('mail') || href.startsWith('mailto:')) {
    return 'Mail'
  }
  if (label.includes('git') || href.includes('github')) {
    return 'Github'
  }
  return 'Terminal'
}

/**
 * Renders the site-wide footer.
 * The footer displays branding, quick links, contact information, and a copyright notice.
 * Content is dynamically sourced from the `ContentContext`.
 * @returns {JSX.Element} The rendered footer component.
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

  const handleQuickLink = (link) => {
    if (!link) return

    const target = link.target
    const href = sanitizeExternalUrl(link.href || link.url)
    const path = link.path

    if (target) {
      navigateContentTarget(target, { navigate, location })
      return
    }

    if (href) {
      if (typeof window === 'undefined') {
        return
      }
      if (href.startsWith('http://') || href.startsWith('https://')) {
        window.open(href, '_blank', 'noopener,noreferrer')
        return
      }
      if (href.startsWith('mailto:') || href.startsWith('tel:')) {
        window.location.href = href
        return
      }
      window.location.assign(href)
      return
    }

    if (path) {
      navigate(path)
      return
    }
  }

  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
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

          {/* Quick Links */}
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

          {/* Contact */}
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

        {/* Bottom Bar */}
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
