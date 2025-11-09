/**
 * Normalizes a user-supplied slug so it only contains lowercase letters, digits, and single hyphens.
 *
 * @param {string} value - Raw slug input from a form field.
 * @returns {string} Sanitized slug that can be safely sent to the backend.
 */
export const sanitizeSlug = (value) => {
  // Return empty string for null, undefined, or empty input
  if (!value) return ''

  // Step 1: Remove diacritical marks (accents) from international characters
  // NFKD normalization separates base characters from combining diacritics
  // The regex [̀-ͯ] matches combining diacritical marks (Unicode range 0x300-0x36F)
  const withoutDiacritics = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')

  // Step 2: Clean and normalize the slug format
  const cleaned = withoutDiacritics
    .toLowerCase()                    // Convert to lowercase for consistency
    .trim()                          // Remove leading/trailing whitespace
    .replace(/[^a-z0-9]+/g, '-')    // Replace any sequence of non-alphanumeric chars with single hyphen
    .replace(/-+/g, '-')             // Collapse multiple consecutive hyphens into single hyphen
    .replace(/^-|-$/g, '')           // Remove hyphens from start and end of string

  // Step 3: Enforce maximum length for database/storage constraints
  const MAX_LENGTH = 100
  const truncated = cleaned.slice(0, MAX_LENGTH)

  return truncated
}

/**
 * Regular expression that defines the valid slug format.
 *
 * Pattern breakdown:
 * ^           - Start of string anchor
 * [a-z0-9]+   - One or more lowercase letters or digits (first segment)
 * (?:         - Start non-capturing group for hyphen-separated segments
 *   -         - Literal hyphen separator
 *   [a-z0-9]+ - One or more lowercase letters or digits (subsequent segment)
 * )*          - End non-capturing group, match zero or more times
 * $           - End of string anchor
 *
 * This ensures:
 * - Only lowercase letters and digits are allowed
 * - Hyphens can only be separators (not at start/end)
 * - No consecutive hyphens are allowed
 * - At least one alphanumeric character is required
 *
 * @constant {RegExp}
 * @readonly
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Validates whether a string already conforms to the slug format used by the CMS.
 *
 * This function is useful for:
 * - Validating user input before attempting to sanitize it
 * - Checking if a slug from the backend already follows the expected format
 * - Form validation to provide immediate feedback
 * - Testing and debugging slug generation logic
 *
 * Examples of valid slugs: "hello", "my-post", "123", "test-123"
 * Examples of invalid slugs: "Hello", "my post", "-invalid", "invalid-", "test--post"
 *
 * @param {string} value - Slug candidate to validate. Can be any string to test.
 * @returns {boolean} True if the slug matches the expected pattern defined by SLUG_REGEX.
 */
export const isValidSlug = (value) => SLUG_REGEX.test(value)
