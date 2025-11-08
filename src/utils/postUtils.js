const MOJIBAKE_REPLACEMENTS = [
  ['Ã¤', 'ä'], // ä
  ['Ã', 'Ä'], // Ä
  ['Ã¶', 'ö'], // ö
  ['Ã', 'Ö'], // Ö
  ['Ã¼', 'ü'], // ü
  ['Ã', 'Ü'], // Ü
  ['Ã', 'ß'], // ß
  ['Ã¡', 'á'], // á
  ['Ã ', 'à'], // à
  ['Ã©', 'é'], // é
  ['Ã¨', 'è'], // è
  ['Ãº', 'ú'], // ú
  ['Ã¹', 'ù'], // ù
  ['Ã³', 'ó'], // ó
  ['Ã²', 'ò'], // ò
  ['Ã±', 'ñ'], // ñ
  ['Ã§', 'ç'], // ç
  ['Ã¥', 'å'], // å
  ['Ã', 'Ø'], // Ø
  ['Ã¸', 'ø'], // ø
  ['â', '–'], // –
  ['â', '—'], // —
  ['â', '„'], // „
  ['â', '“'], // “
  ['â', '”'], // ”
  ['â', '‘'], // ‘
  ['â', '’'], // ’
  ['â¦', '…'], // …
  ['â¢', '•'], // •
  ['Â ', ' '], // non-breaking space
  ['Â', ''],
  ['�', ''],
]

const fixMojibake = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    return value
  }

  if (!/[Ã¤ÃÃ¶ÃÃ¼ÃÃâ]/.test(value)) {
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

/**
 * Normalizes a title value, which can be a string, an array of strings, or an object,
 * into a single, clean string. It also fixes common encoding errors (mojibake).
 *
 * @param {string|Array<string>|object} title - The title value to normalize.
 * @param {string} fallback - The fallback value to return if normalization fails.
 * @returns {string} The normalized title string.
 */
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

/**
 * Normalizes a text value, which can be a string, an array of strings, or an object,
 * into a single, clean string. It also fixes common encoding errors (mojibake).
 *
 * @param {string|Array<string>|object} value - The text value to normalize.
 * @param {string} [fallback=''] - The fallback value to return if normalization fails.
 * @returns {string} The normalized text string.
 */
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

/**
 * Formats an ISO 8601 date string into a localized, human-readable format.
 *
 * @param {string} isoString - The ISO 8601 date string to format.
 * @param {string} [locale='de-DE'] - The locale to use for formatting.
 * @returns {string|null} The formatted date string, or null if the input is invalid.
 */
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

/**
 * Generates a preview text from a post's excerpt or content.
 * It truncates the text to a specified maximum length without cutting words.
 *
 * @param {object} post - The post object.
 * @param {string} [post.excerpt] - The post's excerpt.
 * @param {string} [post.content_markdown] - The post's full Markdown content.
 * @param {number} [maxLength=240] - The maximum length of the preview text.
 * @param {number} [minCutoff=180] - The minimum length before trying to find a natural break.
 * @returns {string} The generated preview text.
 */
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

/**
 * Normalizes a string into a URL-friendly slug.
 * It converts the string to lowercase, removes diacritics, replaces spaces and special characters with hyphens,
 * and truncates it to a safe length.
 *
 * @param {string} value - The string to be converted into a slug.
 * @returns {string} The normalized slug.
 */
export const normalizeSlug = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  const ascii = trimmed
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // drop diacritics

  const sanitized = ascii
    .replace(/[^0-9A-Za-z\s-]/g, '')
    .trim()
    .replace(/[-_\s]+/g, '-') // collapse separators
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return ''
  }

  return sanitized.slice(0, 128)
}
