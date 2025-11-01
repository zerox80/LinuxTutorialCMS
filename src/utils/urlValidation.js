const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

const hasProtocol = (value) => /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)

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

export const isSafeExternalUrl = (value) => sanitizeExternalUrl(value) !== null
