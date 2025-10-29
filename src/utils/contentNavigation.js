import { scrollToSection } from './scrollToSection'

export const navigateContentTarget = (target, { navigate, location } = {}) => {
  if (!target || typeof target !== 'object' || !target.type) {
    return
  }

  const value = target.value ?? target.path ?? target.href

  switch (target.type) {
    case 'section': {
      if (typeof value !== 'string') {
        return
      }

      if (location && location.pathname !== '/') {
        navigate?.('/', { state: { scrollTo: value } })
      } else {
        scrollToSection(value)
      }
      break
    }
    case 'route': {
      if (typeof value === 'string') {
        navigate?.(value)
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
