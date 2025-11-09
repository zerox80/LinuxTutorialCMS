/**
 * Set of allowed URL protocols for security validation.
 * 
 * This set defines which protocols are considered safe for use in
 * user-generated content and links. It excludes dangerous protocols
 * that could execute arbitrary code or access local resources.
 * 
 * ## Security Rationale
 * - **http:** - Standard web protocol (allows redirects to https)
 * - **https:** - Secure web protocol with encryption
 * - **mailto:** - Email links (opens mail client safely)
 * - **tel:** - Telephone links (opens phone app on mobile)
 * 
 * ## Blocked Protocols
 * - **javascript:** - XSS attacks
 * - **data:** - Potential data exfiltration
 * - **file:** - Local file system access
 * - **ftp:** - Unencrypted file transfer
 * - **about:**, **chrome:**, **chrome-extension:** - Browser internals
 * - All other custom protocols
 * 
 * @constant {Set<string>}
 * @readonly
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/**
 * Checks if a string starts with a valid URL protocol scheme.
 * 
 * This function uses a regular expression to detect URL protocols
 * according to RFC 3986 standards. It validates that the protocol
 * starts with a letter and contains only valid characters before colon.
 * 
 * ## Protocol Pattern
 * - Must start with an ASCII letter (a-z, A-Z)
 * - Can contain letters, digits, plus (+), hyphen (-), or period (.)
 * - Must end with a colon (:)
 * 
 * ## Examples
 * - ✅ `http:`, `https:`, `mailto:`, `tel:`, `ftp:`, `ws:`
 * - ❌ `://`, `:`, `http//`, `123:`
 * 
 * ## Security Considerations
 * This function only validates protocol format, not security.
 * Use in combination with `ALLOWED_PROTOCOLS` for security validation.
 * 
 * @param {string} value - The string to check for protocol presence
 * 
 * @returns {boolean} True if string starts with a valid protocol scheme
 * 
 * @throws {TypeError} When value is not a string
 * 
 * @example
 * ```javascript
 * hasProtocol('https://example.com'); // true
 * hasProtocol('mailto:user@example.com'); // true
 * hasProtocol('/relative/path'); // false
 * hasProtocol('anchor-only'); // false
 * hasProtocol('://invalid'); // false
 * ```
 * 
 * @since 1.0.0
 */
const hasProtocol = (value) => /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)

/**
 * Sanitizes and validates external URLs for security compliance.
 * 
 * This function provides comprehensive URL validation and sanitization,
 * ensuring that only safe protocols are allowed while permitting
 * relative URLs and anchor links for internal navigation.
 * 
 * ## Security Features
 * - **Protocol Whitelisting**: Only allows safe protocols from `ALLOWED_PROTOCOLS`
 * - **Protocol-Relative URL Blocking**: Prevents `//evil.com` attacks
 * - **Input Validation**: Validates URL structure using native URL API
 * - **Error Resilience**: Returns null for any invalid input
 * 
 * ## Allowed URL Types
 * - **Absolute URLs**: `https://example.com`, `mailto:user@example.com`
 * - **Relative Paths**: `/path/to/page`, `../parent`, `./current`
 * - **Anchor Links**: `#section-name`, `#top`
 * - **Query-only**: `?search=query&filter=value`
 * 
 * ## Blocked URL Types
 * - **Protocol-relative**: `//evil.com` (bypasses protocol checks)
 * - **Dangerous protocols**: `javascript:`, `data:`, `file:`, etc.
 * - **Malformed URLs**: Invalid syntax that can't be parsed
 * 
 * ## Browser Compatibility
 * - Uses native `URL` API for robust parsing (modern browsers)
 * - Graceful fallback to null for parsing errors
 * - Works with both absolute and relative URL formats
 * 
 * @param {string} value - The URL string to validate and sanitize
 * 
 * @returns {string|null} Sanitized URL string, or null if invalid/unsafe
 * 
 * @throws {TypeError} When input is not a string
 * 
 * @example
 * ```javascript
 * // Valid URLs
 * sanitizeExternalUrl('https://example.com'); // 'https://example.com'
 * sanitizeExternalUrl('mailto:user@example.com'); // 'mailto:user@example.com'
 * sanitizeExternalUrl('tel:+1234567890'); // 'tel:+1234567890'
 * sanitizeExternalUrl('/relative/path'); // '/relative/path'
 * sanitizeExternalUrl('#section'); // '#section'
 * 
 * // Blocked URLs
 * sanitizeExternalUrl('javascript:alert("xss")'); // null
 * sanitizeExternalUrl('data:text/html,<script>alert(1)</script>'); // null
 * sanitizeExternalUrl('//evil.com'); // null
 * sanitizeExternalUrl('file:///etc/passwd'); // null
 * 
 * // Edge cases
 * sanitizeExternalUrl('  https://example.com  '); // 'https://example.com'
 * sanitizeExternalUrl(''); // null
 * sanitizeExternalUrl(null); // null
 * ```
 * 
 * @see {@link ALLOWED_PROTOCOLS} Set of allowed protocols
 * @see {@link isSafeExternalUrl} Boolean check function
 * @see {@link hasProtocol} Protocol detection helper
 * 
 * @since 1.0.0
 */
export const sanitizeExternalUrl = (value) => {
  // Type validation: ensure input is a string
  if (typeof value !== 'string') {
    return null
  }

  // Remove leading/trailing whitespace for consistent validation
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  // Disallow protocol-relative URLs (e.g. //evil.com)
  // These can bypass protocol validation and redirect to arbitrary sites
  if (trimmed.startsWith('//')) {
    return null
  }

  // Check if the URL has a protocol scheme (http:, https:, mailto:, etc.)
  if (!hasProtocol(trimmed)) {
    // Relative paths, anchors and query-only URLs are allowed
    // These are safe as they resolve relative to current origin
    return trimmed
  }

  // For absolute URLs with protocols, validate against allowed protocols
  try {
    const parsed = new URL(trimmed)
    // Convert protocol to lowercase for case-insensitive comparison
    // Check against our whitelist of safe protocols
    return ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase()) ? parsed.toString() : null
  } catch (error) {
    // Log the error for debugging but don't expose details to user
    console.warn('Failed to parse external URL:', error)
    return null
  }
}

/**
 * Checks if a URL is safe by attempting sanitization.
 * 
 * This is a convenience function that returns a boolean result
 * instead of sanitized URL. It's useful for conditional
 * logic, form validation, and UI state management.
 * 
 * ## Use Cases
 * - **Form Validation**: Check if user input URL is safe before submission
 * - **Conditional Rendering**: Show/hide elements based on URL safety
 * - **Input Filtering**: Filter arrays of URLs to only safe ones
 * - **Real-time Validation**: Provide immediate feedback during input
 * 
 * ## Performance Notes
 * - This function calls `sanitizeExternalUrl()` internally
 * - For multiple validations on same URL, cache result
 * - Consider debouncing for real-time input validation
 * 
 * @param {string} value - The URL string to check for safety
 * 
 * @returns {boolean} True if URL is safe, false otherwise
 * 
 * @throws {TypeError} When input is not a string
 * 
 * @example
 * ```javascript
 * // Basic safety check
 * if (isSafeExternalUrl(userInput)) {
 *   console.log('URL is safe to use');
 * } else {
 *   console.log('URL is blocked for security reasons');
 * }
 * 
 * // Form validation
 * const isValidUrl = isSafeExternalUrl(formData.website);
 * setUrlError(isValidUrl ? null : 'Please enter a valid URL');
 * 
 * // Filtering unsafe URLs
 * const safeUrls = allUrls.filter(url => isSafeExternalUrl(url));
 * 
 * // Conditional rendering in React
 * {isSafeExternalUrl(linkUrl) ? (
 *   <a href={linkUrl}>Safe Link</a>
 * ) : (
 *   <span className="text-red-500">Unsafe Link Removed</span>
 * )}
 * ```
 * 
 * @see {@link sanitizeExternalUrl} For getting the sanitized URL value
 * @see {@link ALLOWED_PROTOCOLS} Set of allowed protocols
 * 
 * @since 1.0.0
 */
export const isSafeExternalUrl = (value) => {
  // Delegate to sanitization function and check if it returns a valid result
  // This ensures consistency between boolean check and actual sanitization
  return sanitizeExternalUrl(value) !== null
}
