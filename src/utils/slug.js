/**
 * Normalize user-provided slug strings so they match the backend expectation:
 * only lowercase letters, digits and single hyphens in between.
 */
export const sanitizeSlug = (value) => {
  if (!value) return ''

  const withoutDiacritics = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')

  const cleaned = withoutDiacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // collapse invalid chars into hyphen
    .replace(/-+/g, '-') // collapse duplicate hyphens
    .replace(/^-|-$/g, '') // trim leading/trailing hyphen

  return cleaned
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const isValidSlug = (value) => SLUG_REGEX.test(value)
