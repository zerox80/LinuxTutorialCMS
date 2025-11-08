const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

const hasProtocol = (value) => /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)

/**
 * Sanitizes a URL to ensure it uses an allowed protocol (http, https, mailto, tel).
 * It also allows relative paths and anchors.
 *
 * @param {string} value - The URL to sanitize.
 * @returns {string|null} The sanitized URL, or null if it's invalid or uses a disallowed protocol.
 */
export const sanitizeExternalUrl = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  // Disallow protocol-relative URLs (e.g. //evil.com)
  if (trimmed.startsWith('//')) {
    return null
  }

  if (!hasProtocol(trimmed)) {
    // Relative paths, anchors and query-only URLs are allowed
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    return ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase()) ? parsed.toString() : null
  } catch (error) {
    console.warn('Failed to parse external URL:', error)
    return null
  }
}

/**
 * Checks if a given URL is safe by attempting to sanitize it.
 *
 * @param {string} value - The URL to check.
 * @returns {boolean} True if the URL is safe, otherwise false.
 */
export const isSafeExternalUrl = (value) => sanitizeExternalUrl(value) !== null
