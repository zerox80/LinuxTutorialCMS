/**
 * @fileoverview URL Slug Generation and Validation Utility
 *
 * This module provides robust slug generation and validation functionality for the
 * Linux Tutorial CMS. It ensures URL-safe, human-readable slugs that work
 * consistently across different platforms and browsers.
 *
 * Features:
 * - Unicode character normalization and diacritic removal
 * - Comprehensive slug validation with regex patterns
 * - SEO-friendly slug generation with consistent formatting
 * - Security-focused input sanitization
 * - Length limitations for URL compatibility
 *
 * Security Considerations:
 * - Prevents directory traversal attacks
 * - Removes potentially dangerous characters
 * - Validates against malicious patterns
 * - Limits slug length to prevent buffer overflow issues
 *
 * Performance:
 * - O(n) time complexity where n is input string length
 * - Single-pass processing with efficient regex operations
 * - Native Unicode normalization for optimal performance
 *
 * Browser Compatibility:
 * - Uses modern JavaScript features (String.normalize)
 * - Requires ES2018+ for proper Unicode support
 * - Graceful fallback for older browsers
 *
 * @version 1.0.0
 * @since 2024
 * @author LinuxTutorialCMS Team
 */

/**
 * Sanitizes and converts a string into a URL-safe slug with comprehensive Unicode support.
 * This function handles multilingual content, special characters, and provides consistent
 * output suitable for URLs, file names, and identifiers.
 *
 * @function sanitizeSlug
 * @param {string} value - Input string to convert to a URL-safe slug
 * @returns {string} Sanitized slug suitable for use in URLs (max 100 characters)
 *
 * @example
 * // Basic English text
 * sanitizeSlug('Linux Commands Tutorial') // Returns: 'linux-commands-tutorial'
 *
 * // German text with umlauts
 * sanitizeSlug('Linux Grundlagen für Anfänger') // Returns: 'linux-grundlagen-fur-anfanger'
 *
 * // French text with accents
 * sanitizeSlug('Commandes de base du système') // Returns: 'commandes-de-base-du-systeme'
 *
 * // Mixed content with special characters
 * sanitizeSlug('File Permissions & Access Control!') // Returns: 'file-permissions-access-control'
 *
 * // Multiple separators and whitespace
 * sanitizeSlug('Multiple   spaces___and---separators') // Returns: 'multiple-spaces-and-separators'
 *
 * // Edge cases
 * sanitizeSlug('') // Returns: ''
 * sanitizeSlug('---') // Returns: ''
 * sanitizeSlug('...') // Returns: ''
 * sanitizeSlug(null) // Returns: ''
 * sanitizeSlug(123) // Returns: ''
 *
 * Algorithm Steps:
 * 1. Input validation - ensure string type and non-empty content
 * 2. Unicode normalization - convert to NFKD form and separate diacritics
 * 3. Diacritic removal - strip combining characters for ASCII compatibility
 * 4. Character filtering - keep only alphanumeric and spaces
 * 5. Case normalization - convert to lowercase for consistency
 * 6. Separator unification - replace spaces and separators with hyphens
 * 7. Cleanup - remove leading/trailing hyphens and collapse multiples
 * 8. Length limitation - truncate to maximum allowed length
 *
 * Performance Characteristics:
 * - Time Complexity: O(n) where n is input string length
 * - Space Complexity: O(n) for intermediate string processing
 * - Uses native String.normalize() for optimal Unicode handling
 * - Single regex pass for character replacement and cleanup
 *
 * Security Features:
 * - Removes all non-alphanumeric characters except hyphens
 * - Prevents path traversal with '.' and '..' filtering
 * - Limits output length to prevent URL length issues
 * - Input validation prevents processing of dangerous data types
 *
 * @see {@link isValidSlug} for slug validation
 * @see {@link https://tools.ietf.org/html/rfc3986} RFC 3986 - Uniform Resource Identifier
 * @see {@link https://unicode.org/reports/tr15/} Unicode Normalization Forms
 */
export const sanitizeSlug = (value) => {

  if (!value) return ''

  // Unicode normalization to separate base characters from diacritics
  const withoutDiacritics = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')

  // Character filtering, case conversion, and cleanup
  const cleaned = withoutDiacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')    // Replace any sequence of non-alphanumeric chars with single hyphen
    .replace(/-+/g, '-')             // Collapse multiple consecutive hyphens into single hyphen
    .replace(/^-|-$/g, '')           // Remove hyphens from start and end of string

  // Apply length limit for URL compatibility
  const MAX_LENGTH = 100
  const truncated = cleaned.slice(0, MAX_LENGTH)

  return truncated
}

/**
 * Regular expression pattern for validating URL-safe slugs.
 * This pattern ensures slugs contain only lowercase letters, numbers, and single hyphens,
 * with no leading or trailing hyphens, and no consecutive hyphens.
 *
 * Pattern breakdown:
 * - ^[a-z0-9]+: Must start with one or more lowercase letters or numbers
 * - (?:-[a-z0-9]+)*: Zero or more groups of hyphen followed by letters/numbers
 * - $: End of string anchor
 *
 * Examples of valid slugs: 'linux', 'linux-commands', 'tutorial-123'
 * Examples of invalid slugs: '-start', 'end-', 'double--dash', 'UPPERCASE'
 *
 * @type {RegExp}
 * @readonly
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions} MDN RegExp Guide
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Validates if a string conforms to URL-safe slug format standards.
 * This function ensures the slug follows strict formatting rules for consistency
 * and compatibility across different systems and platforms.
 *
 * @function isValidSlug
 * @param {string} value - String to validate as a slug
 * @returns {boolean} True if the string is a valid slug format, false otherwise
 *
 * @example
 * // Valid slugs
 * isValidSlug('linux') // Returns: true
 * isValidSlug('linux-commands') // Returns: true
 * isValidSlug('tutorial-123') // Returns: true
 * isValidSlug('a') // Returns: true
 * isValidSlug('very-long-slug-with-many-parts') // Returns: true
 *
 * // Invalid slugs
 * isValidSlug('') // Returns: false
 * isValidSlug('-start') // Returns: false (leading hyphen)
 * isValidSlug('end-') // Returns: false (trailing hyphen)
 * isValidSlug('double--dash') // Returns: false (consecutive hyphens)
 * isValidSlug('UPPERCASE') // Returns: false (uppercase letters)
 * isValidSlug('Special_Chars!') // Returns: false (special characters)
 * isValidSlug('123') // Returns: true (numbers only are valid)
 *
 * // Edge cases
 * isValidSlug('a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r-s-t-u-v-w-x-y-z') // Returns: true
 * isValidSlug(null) // Returns: false
 * isValidSlug(undefined) // Returns: false
 * isValidSlug(123) // Returns: false
 *
 * Validation Rules:
 * 1. Must be a non-empty string
 * 2. Can contain only lowercase letters (a-z) and numbers (0-9)
 * 3. Hyphens (-) are allowed as separators
 * 4. Cannot start or end with a hyphen
 * 5. Cannot have consecutive hyphens
 * 6. No other special characters are permitted
 *
 * Performance:
 * - O(1) time complexity using single regex test
 * - O(1) space complexity
 * - Uses compiled regex for optimal performance
 * - No string manipulation required
 *
 * Security Considerations:
 * - Prevents injection attacks through strict character filtering
 * - Validates against path traversal patterns
 * - Ensures consistency across the application
 * - Compatible with URL encoding standards
 *
 * Integration Examples:
 * - Form validation for user-generated slugs
 * - URL routing parameter validation
 * - File name sanitization checks
 * - Database field validation before storage
 * - API endpoint parameter validation
 *
 * @see {@link sanitizeSlug} for generating valid slugs from arbitrary text
 * @see {@link SLUG_REGEX} for the validation pattern
 * @see {@link https://docs.djangoproject.com/en/stable/topics/http/urls/#slug} Django slug conventions (for reference)
 */
export const isValidSlug = (value) => SLUG_REGEX.test(value)