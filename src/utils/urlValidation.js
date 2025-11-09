/**
 * @fileoverview URL Validation and Security Utility
 *
 * This module provides comprehensive URL validation and sanitization functionality
 * for the Linux Tutorial CMS. It ensures safe handling of external URLs with
 * strict protocol validation and XSS prevention.
 *
 * Features:
 * - Strict protocol validation for security
 * - Protection against XSS and injection attacks
 * - Support for common web protocols (http, https, mailto, tel)
 * - Comprehensive error handling and logging
 * - Protocol-less URL handling
 *
 * Security Considerations:
 * - Whitelist-based protocol validation (blacklist avoided)
 * - Prevention of XSS through javascript: protocol blocking
 * - Protection against file:// and other dangerous protocols
 * - Input validation and sanitization
 * - Safe URL construction and parsing
 *
 * Performance:
 * - O(1) time complexity for URL validation
 * - Uses native URL constructor for optimal performance
 * - Early returns for invalid inputs
 * - Minimal memory overhead
 *
 * Browser Compatibility:
 * - Uses native URL constructor (requires modern browsers)
 * - Works in all browsers that support the URL API
 * - Graceful error handling for unsupported protocols
 *
 * @version 1.0.0
 * @since 2024
 * @author LinuxTutorialCMS Team
 */

/**
 * Set of allowed protocols for external URLs.
 * This whitelist approach ensures only safe, commonly-used protocols are permitted.
 *
 * Included protocols:
 * - http: - Standard unencrypted web protocol
 * - https: - Secure encrypted web protocol
 * - mailto: - Email client protocol
 * - tel: - Telephone dialing protocol
 *
 * Excluded protocols (for security):
 * - javascript: - XSS injection risk
 * - data: - Potential injection vector
 * - file: - Local file access risk
 * - ftp: - Outdated protocol with security issues
 * - blob: - Potential security risk
 *
 * @type {Set<string>}
 * @readonly
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP} HTTP documentation
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/URI/Schemes} URI schemes documentation
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/**
 * Regular expression for detecting protocol prefixes in URLs.
 * Matches standard URL protocol patterns like "http:", "https:", "mailto:", etc.
 *
 * Pattern breakdown:
 * - ^: Start of string anchor
 * - [a-zA-Z]: Must start with a letter
 * - [a-zA-Z0-9+.-]*: Followed by letters, numbers, plus, dot, or hyphen
 * - :: Protocol separator
 *
 * @type {RegExp}
 * @readonly
 * @see {@link https://datatracker.ietf.org/doc/html/rfc3986#section-3.1} URI scheme specification
 */
const hasProtocol = (value) => /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)

/**
 * Sanitizes and validates external URLs with comprehensive security checks.
 * This function ensures URLs are safe for use in links, redirects, and other
 * user-facing contexts while preventing XSS and injection attacks.
 *
 * @function sanitizeExternalUrl
 * @param {string} value - URL string to sanitize and validate
 * @returns {string|null} Sanitized safe URL or null if invalid/unsafe
 *
 * @example
 * // Valid URLs (allowed protocols)
 * sanitizeExternalUrl('https://example.com') // Returns: 'https://example.com/'
 * sanitizeExternalUrl('http://linux.org') // Returns: 'http://linux.org/'
 * sanitizeExternalUrl('mailto:user@example.com') // Returns: 'mailto:user@example.com'
 * sanitizeExternalUrl('tel:+1234567890') // Returns: 'tel:+1234567890'
 *
 * // Protocol-less URLs (treated as safe relative paths)
 * sanitizeExternalUrl('/path/to/page') // Returns: '/path/to/page'
 * sanitizeExternalUrl('relative-path') // Returns: 'relative-path'
 * sanitizeExternalUrl('#anchor') // Returns: '#anchor'
 *
 * // Invalid or unsafe URLs (return null)
 * sanitizeExternalUrl('javascript:alert("xss")') // Returns: null (XSS risk)
 * sanitizeExternalUrl('data:text/html,<script>alert("xss")</script>') // Returns: null
 * sanitizeExternalUrl('file:///etc/passwd') // Returns: null (security risk)
 * sanitizeExternalUrl('ftp://server.com') // Returns: null (unsupported protocol)
 *
 * // Edge cases
 * sanitizeExternalUrl('') // Returns: null
 * sanitizeExternalUrl(null) // Returns: null
 * sanitizeExternalUrl(undefined) // Returns: null
 * sanitizeExternalUrl(123) // Returns: null
 * sanitizeExternalUrl({}) // Returns: null
 *
 * // Protocol-relative URLs (blocked for security)
 * sanitizeExternalUrl('//example.com/script.js') // Returns: null
 *
 * URL Processing Steps:
 * 1. Input validation - ensure string type and non-empty content
 * 2. Protocol detection - check if URL has protocol prefix
 * 3. Security filtering - block dangerous patterns and protocols
 * 4. Protocol validation - ensure protocol is in allowed whitelist
 * 5. URL parsing and reconstruction - using native URL constructor
 * 6. Return sanitized URL or null if validation fails
 *
 * Security Features:
 * - Whitelist-based protocol validation (secure by default)
 * - Blocks javascript: protocol to prevent XSS attacks
 * - Prevents protocol-relative URLs (//) which can be exploited
 * - Validates URL structure using native URL constructor
 * - Comprehensive error handling for malformed URLs
 *
 * Performance Characteristics:
 * - Time Complexity: O(1) for protocol detection and URL parsing
 * - Space Complexity: O(1) - minimal temporary variables
 * - Uses native browser APIs for optimal performance
 * - Early returns for invalid inputs to avoid unnecessary processing
 *
 * Browser Compatibility:
 * - Requires URL constructor support (modern browsers)
 * - Works in Chrome 32+, Firefox 26+, Safari 7+, Edge 12+
 * - Graceful fallback for older browsers with try-catch
 *
 * Integration Examples:
 * - Link validation in user-generated content
 * - Redirect URL sanitization
 * - External link safety checking
 * - Form action URL validation
 * - API endpoint URL verification
 *
 * @see {@link isSafeExternalUrl} for boolean validation
 * @see {@link ALLOWED_PROTOCOLS} for list of allowed protocols
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/URL} MDN URL API documentation
 * @see {@link https://owasp.org/www-community/attacks/xss/} OWASP XSS Prevention
 */
export const sanitizeExternalUrl = (value) => {

  // Input validation
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  // Block protocol-relative URLs for security (e.g., //example.com)
  if (trimmed.startsWith('//')) {
    return null
  }

  // If no protocol, treat as relative path (considered safe)
  if (!hasProtocol(trimmed)) {
    return trimmed
  }

  // Parse and validate URLs with protocols
  try {
    const parsed = new URL(trimmed)

    // Validate protocol against allowed whitelist
    return ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase()) ? parsed.toString() : null
  } catch (error) {
    // Log malformed URLs for debugging
    console.warn('Failed to parse external URL:', error)
    return null
  }
}

/**
 * Quickly determines if a URL is safe for external use.
 * This is a convenience function that returns a boolean without
 * returning the sanitized URL value.
 *
 * @function isSafeExternalUrl
 * @param {string} value - URL to check for safety
 * @returns {boolean} True if URL is safe and valid, false otherwise
 *
 * @example
 * // Safe URLs
 * isSafeExternalUrl('https://example.com') // Returns: true
 * isSafeExternalUrl('/local/path') // Returns: true
 * isSafeExternalUrl('mailto:user@example.com') // Returns: true
 *
 * // Unsafe URLs
 * isSafeExternalUrl('javascript:alert("xss")') // Returns: false
 * isSafeExternalUrl('data:text/html,<script>') // Returns: false
 * isSafeExternalUrl('//example.com') // Returns: false
 *
 * // Edge cases
 * isSafeExternalUrl('') // Returns: false
 * isSafeExternalUrl(null) // Returns: false
 * isSafeExternalUrl(undefined) // Returns: false
 *
 * Use Cases:
 * - Form validation before submission
 * - Conditional rendering of external links
 * - Security checks in routing
 * - Input validation in API endpoints
 * - Content filtering in CMS
 *
 * Performance:
 * - O(1) time complexity (delegates to sanitizeExternalUrl)
 * - Minimal overhead for boolean checks
 * - No URL construction if not needed
 *
 * @see {@link sanitizeExternalUrl} for URL sanitization with return value
 * @see {@link ALLOWED_PROTOCOLS} for security whitelist
 */
export const isSafeExternalUrl = (value) => {

  return sanitizeExternalUrl(value) !== null
}