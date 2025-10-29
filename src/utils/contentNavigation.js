import { scrollToSection } from './scrollToSection'

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
        window.open(value, '_blank', 'noopener,noreferrer')
      }
      break
    }
    case 'href': {
      if (typeof window !== 'undefined' && value) {
        window.location.assign(value)
      }
      break
    }
    default:
      break
  }
}
