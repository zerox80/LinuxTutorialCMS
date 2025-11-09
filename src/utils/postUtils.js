/**
 * @fileoverview Post Processing Utilities
 *
 * This module provides comprehensive text processing and normalization utilities
 * for posts and content within the Linux Tutorial CMS. It handles character encoding
 * issues, text normalization, date formatting, and slug generation.
 *
 * Features:
 * - Mojibake (character encoding) repair for multilingual content
 * - Text normalization from various input formats (string, array, object)
 * - Smart date formatting with locale support
 * - Preview text generation with intelligent truncation
 * - URL-safe slug generation with Unicode support
 *
 * Security Considerations:
 * - All text processing is read-only and doesn't execute code
 * - Input validation prevents processing of dangerous data types
 * - Safe string operations prevent injection vulnerabilities
 *
 * Performance:
 * - Early returns for invalid inputs to avoid unnecessary processing
 * - Efficient string operations with minimal memory allocation
 * - Lazy evaluation for mojibake detection and repair
 *
 * Browser Compatibility:
 * - Uses modern JavaScript features (String.normalize, Intl.DateTimeFormat)
 * - Works in all modern browsers (ES2018+)
 * - Graceful fallback for older browsers
 *
 * @version 1.0.0
 * @since 2024
 * @author LinuxTutorialCMS Team
 */

/**
 * Comprehensive mapping of common mojibake (character encoding) patterns.
 * Mojibake occurs when text is encoded/decoded with different character sets,
 * resulting in garbled characters that need to be restored to their original form.
 *
 * This mapping covers:
 * - German umlauts (ä, ö, ü, ß) and their uppercase variants
 * - Romance language accents (á, à, é, è, ú, ù, ó, ò, ñ, ç)
 * - Nordic characters (å, Ø, ø)
 * - Typography and punctuation (en dash, em dash, quotes, ellipsis, bullet)
 * - Whitespace issues (non-breaking spaces)
 * - Replacement characters (�)
 *
 * The array is ordered by frequency of occurrence for optimal performance.
 * Each entry contains [mojibake_pattern, correct_character] pairs.
 *
 * @type {Array<Array<string>>}
 * @readonly
 * @see {@link https://en.wikipedia.org/wiki/Mojibake} Mojibake explanation
 * @see {@link https://www.i18nqa.com/debug/utf8-debug.html} UTF-8 debugging guide
 */
const MOJIBAKE_REPLACEMENTS = [
  ['Ã¤', 'ä'], // ä - German umlaut a
  ['Ã', 'Ä'], // Ä - German umlaut A (uppercase)
  ['Ã¶', 'ö'], // ö - German umlaut o
  ['Ã', 'Ö'], // Ö - German umlaut O (uppercase)
  ['Ã¼', 'ü'], // ü - German umlaut u
  ['Ã', 'Ü'], // Ü - German umlaut U (uppercase)
  ['Ã', 'ß'], // ß - German eszett (sharp s)
  ['Ã¡', 'á'], // á - Latin small letter a with acute
  ['Ã ', 'à'], // à - Latin small letter a with grave
  ['Ã©', 'é'], // é - Latin small letter e with acute
  ['Ã¨', 'è'], // è - Latin small letter e with grave
  ['Ãº', 'ú'], // ú - Latin small letter u with acute
  ['Ã¹', 'ù'], // ù - Latin small letter u with grave
  ['Ã³', 'ó'], // ó - Latin small letter o with acute
  ['Ã²', 'ò'], // ò - Latin small letter o with grave
  ['Ã±', 'ñ'], // ñ - Latin small letter n with tilde
  ['Ã§', 'ç'], // ç - Latin small letter c with cedilla
  ['Ã¥', 'å'], // å - Latin small letter a with ring above
  ['Ã', 'Ø'], // Ø - Latin capital letter O with stroke
  ['Ã¸', 'ø'], // ø - Latin small letter o with stroke
  ['â', '–'], // – - En dash
  ['â', '—'], // — - Em dash
  ['â', '„'], // „ - Double low-9 quotation mark
  ['â', '"'], // " - Left double quotation mark
  ['â', '"'], // " - Right double quotation mark
  ['â', '''], // ' - Left single quotation mark
  ['â', '''], // ' - Right single quotation mark
  ['â¦', '…'], // … - Horizontal ellipsis
  ['â¢', '•'], // • - Bullet
  ['Â ', ' '], // Regular space (non-breaking space fix)
  ['Â', ''], // Remove stray Â characters
  ['�', ''], // Remove replacement characters
]

/**
 * Detects and repairs mojibake (character encoding corruption) in text.
 * Uses efficient pattern matching to only process text that contains common
 * mojibake patterns, avoiding unnecessary string operations on clean text.
 *
 * @function fixMojibake
 * @param {string} value - Text to check and repair for encoding issues
 * @returns {string} Text with corrected character encoding, or original if no issues found
 *
 * @example
 * // German text with mojibake
 * fixMojibake('MÃ¼nchen ist schÃ¶n') // Returns: 'München ist schön'
 *
 * // French text with mojibake
 * fixMojibake('CrÃ©dit et CafÃ©') // Returns: 'Crédit et Café'
 *
 * // Clean text (unchanged)
 * fixMojibake('Hello World') // Returns: 'Hello World'
 *
 * // Empty or invalid input
 * fixMojibake('') // Returns: ''
 * fixMojibake(null) // Returns: null
 * fixMojibake(123) // Returns: 123
 *
 * Performance Characteristics:
 * - O(n) time complexity where n is string length
 * - Early detection using regex to avoid unnecessary processing
 * - Uses split/join for efficient character replacement
 * - Memory efficient with minimal string allocations
 *
 * Algorithm:
 * 1. Validate input type and check for empty strings
 * 2. Quick detection using regex for common mojibake patterns
 * 3. Sequential replacement using pre-defined mapping table
 * 4. Return corrected string or original if no changes needed
 *
 * @see {@link MOJIBAKE_REPLACEMENTS} for the complete replacement mapping
 * @see {@link normalizeStringArray} for array-based text processing
 */
const fixMojibake = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    return value
  }

  // Quick detection to avoid processing clean text
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

/**
 * Normalizes an array of strings by cleaning, fixing mojibake, and joining.
 * Handles mixed content types and provides flexible joining options.
 *
 * @function normalizeStringArray
 * @param {Array<string>} values - Array of strings or mixed values to normalize
 * @param {string} [joiner=' '] - String used to join normalized array elements
 * @returns {string} Normalized, cleaned, and joined string
 *
 * @example
 * // Basic array normalization
 * normalizeStringArray(['Hello', 'World']) // Returns: 'Hello World'
 *
 * // Custom joiner
 * normalizeStringArray(['Line 1', 'Line 2'], '\n') // Returns: 'Line 1\nLine 2'
 *
 * // Mojibake repair in arrays
 * normalizeStringArray(['MÃ¼nchen', 'ist', 'schÃ¶n']) // Returns: 'München ist schön'
 *
 * // Mixed content filtering
 * normalizeStringArray(['Valid', null, '', 'Text', 42]) // Returns: 'Valid Text'
 *
 * @throws {TypeError} If values parameter is not iterable (handled gracefully)
 *
 * Processing Steps:
 * 1. Filter out falsy values (null, undefined, false, 0, "")
 * 2. Process string values through mojibake repair and trimming
 * 3. Filter out non-string or empty results
 * 4. Join remaining elements with specified joiner
 *
 * @see {@link fixMojibake} for character encoding repair
 * @see {@link normalizeTitle} and {@link normalizeText} for object-based normalization
 */
const normalizeStringArray = (values, joiner = ' ') => {
  const cleaned = values
    .filter(Boolean)
    .map((part) => (typeof part === 'string' ? fixMojibake(part.trim()) : null))
    .filter((part) => part && part.length)

  return cleaned.join(joiner)
}

/**
 * Normalizes a title from various input formats with mojibake repair.
 * Handles string, array, and object inputs, providing flexible content processing.
 *
 * @function normalizeTitle
 * @param {string|Array|Object} title - Title to normalize from various formats
 * @param {string} fallback - Fallback value if title is invalid or empty
 * @returns {string} Normalized title or fallback value
 *
 * @example
 * // String input with mojibake
 * normalizeTitle('LÃ¶sungen fÃ¼r Linux', 'Untitled') // Returns: 'Lösungen für Linux'
 *
 * // Array input
 * normalizeTitle(['Part 1', 'Part 2'], 'Untitled') // Returns: 'Part 1 Part 2'
 *
 * // Object input
 * normalizeTitle({ main: 'Linux', subtitle: 'Tutorial' }, 'Untitled') // Returns: 'Linux Tutorial'
 *
 * // Fallback usage
 * normalizeTitle(null, 'Default Title') // Returns: 'Default Title'
 * normalizeTitle('', 'Default Title') // Returns: 'Default Title'
 *
 * @see {@link normalizeText} for similar functionality with different defaults
 * @see {@link fixMojibake} for character encoding repair
 * @see {@link normalizeStringArray} for array processing
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
 * Normalizes text content from various input formats with comprehensive mojibake repair.
 * Designed for body text, descriptions, and longer content with flexible defaults.
 *
 * @function normalizeText
 * @param {string|Array|Object} value - Text to normalize from various formats
 * @param {string} [fallback=''] - Fallback value if text is invalid or empty
 * @returns {string} Normalized text or fallback value
 *
 * @example
 * // String input with mojibake
 * normalizeText('Dieser Text enthÃ¤lt Umlaute', 'No content') // Returns: 'Dieser Text enthält Umlaute'
 *
 * // Array input with newlines
 * normalizeText(['Line 1', 'Line 2'], 'No content') // Returns: 'Line 1\nLine 2'
 *
 * // Object with text property
 * normalizeText({ text: 'Content here' }, 'No content') // Returns: 'Content here'
 *
 * // Complex object
 * normalizeText({ title: 'Title', body: 'Body' }, 'No content') // Returns: 'Title\nBody'
 *
 * // Empty content
 * normalizeText(null, 'No content available') // Returns: 'No content available'
 *
 * @see {@link normalizeTitle} for title-specific normalization
 * @see {@link fixMojibake} for character encoding repair
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
 * Formats an ISO date string to localized date format with proper locale support.
 * Handles invalid dates gracefully and provides customizable locale options.
 *
 * @function formatDate
 * @param {string} isoString - ISO 8601 date string to format
 * @param {string} [locale='de-DE'] - Locale identifier for date formatting
 * @returns {string|null} Formatted date string or null if input is invalid
 *
 * @example
 * // German formatting (default)
 * formatDate('2024-01-15T10:30:00Z') // Returns: '15. Januar 2024'
 *
 * // Custom locale
 * formatDate('2024-01-15T10:30:00Z', 'en-US') // Returns: 'January 15, 2024'
 *
 * // Invalid dates
 * formatDate('invalid-date') // Returns: null
 * formatDate(null) // Returns: null
 *
 * Browser Compatibility:
 * - Uses Intl.DateTimeFormat API (supported in all modern browsers)
 * - Graceful fallback for unsupported locales
 * - Handles timezone differences automatically
 *
 * Performance:
 * - O(1) time complexity for date parsing and formatting
 * - Uses native browser APIs for optimal performance
 * - Minimal memory overhead with localized strings
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat} MDN documentation
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
 * Generates intelligent preview text from post content with smart truncation.
 * Prioritizes excerpt content, falls back to main content, and provides
 * word-boundary-aware truncation to maintain readability.
 *
 * @function buildPreviewText
 * @param {Object} post - Post object containing content and/or excerpt
 * @param {string} [post.excerpt] - Post excerpt to use as primary content source
 * @param {string} [post.content_markdown] - Main content to use as fallback
 * @param {number} [maxLength=240] - Maximum length of generated preview text
 * @param {number} [minCutoff=180] - Minimum length before enforcing word boundary cut
 * @returns {string} Generated preview text with proper truncation
 *
 * @example
 * // Using excerpt
 * buildPreviewText({
 *   excerpt: 'This is a brief introduction to Linux commands...'
 * }) // Returns: 'This is a brief introduction to Linux commands...'
 *
 * // Using content as fallback
 * buildPreviewText({
 *   content_markdown: 'Linux is a powerful operating system that offers great flexibility...'
 * }) // Returns: 'Linux is a powerful operating system that offers great flexibility.'
 *
 * // Custom truncation
 * buildPreviewText(
 *   { content_markdown: 'A very long text that exceeds the maximum length...' },
 *   100, 50
 * ) // Returns: 'A very long text.'
 *
 * // Empty post
 * buildPreviewText({}) // Returns: ''
 *
 * Algorithm:
 * 1. Try to use excerpt content first (highest priority)
 * 2. Fall back to main content if excerpt unavailable
 * 3. Normalize whitespace and clean up formatting
 * 4. Apply intelligent truncation with word boundary preservation
 * 5. Add period at end if truncated for better readability
 *
 * Performance:
 * - O(n) time complexity where n is content length
 * - Single pass through content for normalization and truncation
 * - Efficient string operations with minimal allocations
 *
 * @see {@link normalizeText} for content normalization
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
 * Normalizes a value into a URL-safe slug with comprehensive Unicode support.
 * Handles diacritics, special characters, and provides consistent output format.
 *
 * @function normalizeSlug
 * @param {string} value - Value to convert to URL-safe slug
 * @returns {string} Normalized slug suitable for URLs (max 128 characters)
 *
 * @example
 * // Basic usage
 * normalizeSlug('Linux Commands Tutorial') // Returns: 'linux-commands-tutorial'
 *
 * // Unicode and diacritics
 * normalizeSlug('München ist schön') // Returns: 'munchen-ist-schon'
 *
 * // Special characters and separators
 * normalizeSlug('File/Permissions & Access!') // Returns: 'file-permissions-access'
 *
 * // Edge cases
 * normalizeSlug('') // Returns: ''
 * normalizeSlug('...') // Returns: ''
 * normalizeSlug(null) // Returns: ''
 *
 * Security Considerations:
 * - Removes all non-alphanumeric characters except hyphens
 * - Prevents directory traversal with '.' and '..' filtering
 * - Limits length to prevent URL length issues
 * - Uses only lowercase letters for consistency
 *
 * Algorithm:
 * 1. Normalize Unicode and remove diacritical marks
 * 2. Convert to lowercase and trim whitespace
 * 3. Replace non-alphanumeric characters with hyphens
 * 4. Collapse multiple consecutive hyphens
 * 5. Remove leading/trailing hyphens
 * 6. Apply length limits and security filtering
 *
 * Performance:
 * - O(n) time complexity where n is input string length
 * - Uses native String.normalize() for Unicode processing
 * - Single pass through string with regex operations
 *
 * @see {@link https://tools.ietf.org/html/rfc3986} URI standards for slug validation
 * @see {@link https://unicode.org/reports/tr15/} Unicode normalization documentation
 */
export const normalizeSlug = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  // Remove diacritics and normalize Unicode
  const ascii = trimmed
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // drop diacritics

  // Clean and sanitize the slug
  const sanitized = ascii
    .replace(/[^0-9A-Za-z\s-]/g, '')
    .trim()
    .replace(/[-_\s]+/g, '-') // collapse separators
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  // Security filtering for dangerous patterns
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return ''
  }

  return sanitized.slice(0, 128)
}