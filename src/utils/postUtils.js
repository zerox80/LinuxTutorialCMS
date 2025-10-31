const fixMojibake = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    return value
  }

  if (!/[ÃÂâ€™“”–…]|�/.test(value)) {
    return value
  }

  const replacements = [
    ['Ã¤', 'ä'],
    ['Ã„', 'Ä'],
    ['Ã¶', 'ö'],
    ['Ã–', 'Ö'],
    ['Ã¼', 'ü'],
    ['Ãœ', 'Ü'],
    ['ÃŸ', 'ß'],
    ['Ã¡', 'á'],
    ['Ã ', 'à'],
    ['Ã©', 'é'],
    ['Ã¨', 'è'],
    ['Ãº', 'ú'],
    ['Ã³', 'ó'],
    ['Ã´', 'ô'],
    ['Ã§', 'ç'],
    ['Ã±', 'ñ'],
    ['Â ', ' '],
    ['Â', ''],
    ['â€“', '–'],
    ['â€”', '—'],
    ['â€ž', '„'],
    ['â€š', '‚'],
    ['â€œ', '“'],
    ['â€', '”'],
    ['â€™', '’'],
    ['â€˜', '‘'],
    ['â€¢', '•'],
    ['â€¦', '…'],
    ['â„¢', '™'],
    ['â‚¬', '€'],
    ['�', ''],
  ]

  let result = value
  for (const [search, replacement] of replacements) {
    if (result.includes(search)) {
      result = result.split(search).join(replacement)
    }
  }
  return result
}

const normalizeStringArray = (values, joiner = ' ') => {
  const cleaned = values
    .filter(Boolean)
    .map((part) => (typeof part === 'string' ? fixMojibake(part.trim()) : null))
    .filter((part) => part && part.length)

  return cleaned.join(joiner)
}

export const normalizeTitle = (title, fallback) => {
  if (!title) return fallback
  if (typeof title === 'string') return fixMojibake(title)
  if (Array.isArray(title)) {
    const joined = normalizeStringArray(title)
    if (joined) {
      return joined
    }
  }
  if (typeof title === 'object') {
    const values = Object.values(title).filter((part) => typeof part === 'string' && part.trim())
    if (values.length) {
      return normalizeStringArray(values)
    }
  }
  return fallback
}

export const normalizeText = (value, fallback = '') => {
  if (!value) return fallback
  if (typeof value === 'string') return fixMojibake(value)
  if (Array.isArray(value)) {
    const text = normalizeStringArray(value, '\n')
    return text || fallback
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string' && value.text.trim()) {
      return fixMojibake(value.text)
    }
    const values = Object.values(value).filter((part) => typeof part === 'string' && part.trim())
    if (values.length) {
      return normalizeStringArray(values, '\n')
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
