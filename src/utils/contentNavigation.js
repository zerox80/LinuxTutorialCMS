import { scrollToSection } from './scrollToSection'
import { sanitizeExternalUrl } from './urlValidation'

const normalizeSectionId = (value) => {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return ''
}

const buildPagePath = (value) => {
  if (!value) {
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    return trimmed.startsWith('/') ? trimmed : `/pages/${trimmed}`
  }
  if (typeof value === 'object') {
    const slug = value.slug || value.path || value.value
    if (typeof slug === 'string' && slug.trim()) {
      const sanitized = slug.trim()
      return sanitized.startsWith('/') ? sanitized : `/pages/${sanitized}`
    }
  }
  return null
}

/**
 * Handles navigation based on a content target object.
 * This function interprets a target object (e.g., from a CMS) and performs the appropriate
 * navigation action, such as scrolling to a section, changing the route, or opening an external link.
 *
 * @param {object} target - The content target object.
 * @param {string} target.type - The type of navigation target (e.g., 'section', 'route', 'page', 'external', 'href').
 * @param {*} [target.value] - The value associated with the target (e.g., section ID, route path, URL).
 * @param {object} [options] - Navigation options.
 * @param {Function} [options.navigate] - The `navigate` function from `react-router-dom`.
 * @param {object} [options.location] - The `location` object from `react-router-dom`.
 */
export const navigateContentTarget = (target, { navigate, location } = {}) => {
  if (!target || typeof target !== 'object' || !target.type) {
    return
  }

  const value = target.value ?? target.path ?? target.href

  switch (target.type) {
    case 'section': {
      const sectionId = normalizeSectionId(value)
      if (!sectionId) {
        return
      }

      if (location && location.pathname !== '/') {
        navigate?.('/', { state: { scrollTo: sectionId } })
      } else {
        scrollToSection(sectionId)
      }
      break
    }
    case 'route': {
      if (typeof value === 'string') {
        navigate?.(value)
      }
      break
    }
    case 'page': {
      const path = buildPagePath(value)
      if (path) {
        navigate?.(path)
      }
      break
    }
    case 'external': {
      if (typeof window !== 'undefined' && value) {
        const safeUrl = sanitizeExternalUrl(value)
        if (!safeUrl) {
          console.warn('Blocked unsafe external navigation target:', value)
          return
        }
        window.open(safeUrl, '_blank', 'noopener,noreferrer')
      }
      break
    }
    case 'href': {
      if (typeof window !== 'undefined' && value) {
        const safeUrl = sanitizeExternalUrl(value)
        if (!safeUrl) {
          console.warn('Blocked unsafe href navigation target:', value)
          return
        }
        if (safeUrl.startsWith('#')) {
          scrollToSection(safeUrl.slice(1))
          return
        }
        window.location.assign(safeUrl)
      }
      break
    }
    default:
      break
  }
}
