export const normalizeTitle = (title, fallback) => {
  if (!title) return fallback
  if (typeof title === 'string') return title
  if (Array.isArray(title)) {
    const joined = title.filter(Boolean).join(' ')
    if (joined.trim()) {
      return joined
    }
  }
  if (typeof title === 'object') {
    const values = Object.values(title).filter((part) => typeof part === 'string' && part.trim())
    if (values.length) {
      return values.join(' ')
    }
  }
  return fallback
}

export const normalizeText = (value, fallback = '') => {
  if (!value) return fallback
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const text = value.filter((part) => typeof part === 'string').join('\n')
    return text || fallback
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string' && value.text.trim()) {
      return value.text
    }
    const values = Object.values(value).filter((part) => typeof part === 'string' && part.trim())
    if (values.length) {
      return values.join('\n')
    }
  }
  return fallback
}

export const formatDate = (isoString, locale = 'de-DE') => {
  if (!isoString) return null
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export const buildPreviewText = (post, maxLength = 240, minCutoff = 180) => {
  const excerpt = normalizeText(post?.excerpt)
  const fallback = normalizeText(post?.content_markdown)
  const source = (excerpt || fallback || '').replace(/\s+/g, ' ').trim()
  if (!source) {
    return ''
  }

  if (source.length <= maxLength) {
    return source
  }

  const truncated = source.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  const safeCut = lastSpace > minCutoff ? truncated.slice(0, lastSpace) : truncated
  return `${safeCut.trim()}…`
}

export const normalizeSlug = (value) => {
  if (!value || typeof value !== 'string') {
    return ''
  }
  return value.trim().toLowerCase()
}
