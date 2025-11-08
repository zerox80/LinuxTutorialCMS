/**
 * Normalizes a user-supplied slug so it only contains lowercase letters, digits, and single hyphens.
 *
 * @param {string} value - Raw slug input from a form field.
 * @returns {string} Sanitized slug that can be safely sent to the backend.
 */
export const sanitizeSlug = (value) => {
  if (!value) return ''

  const withoutDiacritics = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')

  const cleaned = withoutDiacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // collapse invalid chars into hyphen
    .replace(/-+/g, '-') // collapse duplicate hyphens
    .replace(/^-|-$/g, '') // trim leading/trailing hyphen

  const MAX_LENGTH = 100
  const truncated = cleaned.slice(0, MAX_LENGTH)

  return truncated
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Validates whether a string already conforms to the slug format used by the CMS.
 *
 * @param {string} value - Slug candidate to validate.
 * @returns {boolean} True if the slug matches the expected pattern.
 */
export const isValidSlug = (value) => SLUG_REGEX.test(value)
