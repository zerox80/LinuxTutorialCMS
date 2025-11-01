const MOJIBAKE_REPLACEMENTS = [
  ['\u00C3\u00A4', 'ä'],
  ['\u00C3\u0084', 'Ä'],
  ['\u00C3\u00B6', 'ö'],
  ['\u00C3\u0096', 'Ö'],
  ['\u00C3\u00BC', 'ü'],
  ['\u00C3\u009C', 'Ü'],
  ['\u00C3\u009F', 'ß'],
  ['\u00C3\u00A1', 'á'],
  ['\u00C3\u00A0', 'à'],
  ['\u00C3\u00A9', 'é'],
  ['\u00C3\u00A8', 'è'],
  ['\u00C3\u00BA', 'ú'],
  ['\u00C3\u00B9', 'ù'],
  ['\u00C3\u00B3', 'ó'],
  ['\u00C3\u00B2', 'ò'],
  ['\u00C3\u00B1', 'ñ'],
  ['\u00C3\u00A7', 'ç'],
  ['\u00C3\u00A5', 'å'],
  ['\u00C3\u0098', 'Ø'],
  ['\u00C3\u00B8', 'ø'],
  ['\u00E2\u0080\u0093', '–'],
  ['\u00E2\u0080\u0094', '—'],
  ['\u00E2\u0080\u009E', '„'],
  ['\u00E2\u0080\u009C', '“'],
  ['\u00E2\u0080\u009D', '”'],
  ['\u00E2\u0080\u0098', '‘'],
  ['\u00E2\u0080\u0099', '’'],
  ['\u00E2\u0080\u00A6', '…'],
  ['\u00E2\u0080\u00A2', '•'],
  ['\u00C2\u00A0', ' '],
  ['\u00C2', ''],
  ['\uFFFD', ''],
]

const fixMojibake = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    return value
  }

  if (!/[ÃÂâ€™“”–…�]/.test(value)) {
    return value
  }

  let result = value
  for (const [search, replacement] of MOJIBAKE_REPLACEMENTS) {
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
  return `${safeCut.trim()}.`
}

export const normalizeSlug = (value) => {
  if (!value || typeof value !== 'string') {
    return ''
  }
  return value.trim().toLowerCase()
}
