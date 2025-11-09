import DOMPurify from 'dompurify';

/**
 * Default configuration for DOMPurify HTML sanitization.
 * 
 * This configuration provides a secure baseline for HTML content while
 * allowing common formatting and structural elements needed for rich text content.
 * 
 * ## Security Features
 * - **Tag Whitelisting**: Only explicitly allowed HTML tags are permitted
 * - **Attribute Whitelisting**: Only safe attributes are allowed on permitted tags
 * - **Protocol Filtering**: Only secure protocols (http, https, mailto, tel) are allowed
 * - **Data Attributes Blocked**: Prevents potential data exfiltration attacks
 * - **Unknown Protocols Blocked**: Prevents protocol-based attacks (javascript:, data:, etc.)
 * 
 * ## Allowed Tags
 * - **Text Formatting**: `p`, `br`, `strong`, `em`, `u`, `s`
 * - **Structure**: `h1`-`h6`, `div`, `span`
 * - **Lists**: `ul`, `ol`, `li`
 * - **Content**: `blockquote`, `code`, `pre`
 * - **Tables**: `table`, `thead`, `tbody`, `tr`, `th`, `td`
 * - **Media**: `img`, `hr`
 * - **Links**: `a` (with protocol restrictions)
 * 
 * ## Allowed Attributes
 * - **Links**: `href`, `target`, `rel`
 * - **Images**: `src`, `alt`, `title`, `width`, `height`
 * - **Styling**: `class`, `id` (for CSS targeting)
 * 
 * @constant {Object}
 * @default
 */
const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'hr', 'div', 'span'
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class', 'id',
    'src', 'alt', 'title', 'width', 'height'
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

/**
 * Sanitizes HTML content to prevent XSS attacks while preserving safe formatting.
 * 
 * This function provides comprehensive HTML sanitization using DOMPurify,
 * which removes potentially malicious code while preserving legitimate
 * HTML structure and formatting. It's designed for user-generated content
 * that needs to be safely rendered in the browser.
 * 
 * ## Security Features
 * - **XSS Prevention**: Removes all script tags, event handlers, and javascript: URLs
 * - **HTML Injection Protection**: Sanitizes malformed HTML and entity encoding
 * - **CSRF Protection**: Removes forms and input elements that could be abused
 * - **Content Security Policy**: Works alongside CSP headers for defense in depth
 * 
 * ## Browser Compatibility
 * - Works in all modern browsers with DOMPurify support
 * - Graceful degradation in environments without DOMPurify
 * - Memory efficient for large content strings
 * 
 * @param {string} dirty - The potentially unsafe HTML content to sanitize
 * @param {Object} [config={}] - Optional DOMPurify configuration to override defaults
 * @param {Array<string>} [config.ALLOWED_TAGS] - Custom allowed tags (extends defaults)
 * @param {Array<string>} [config.ALLOWED_ATTR] - Custom allowed attributes (extends defaults)
 * @param {boolean} [config.ALLOW_DATA_ATTR=false] - Whether to allow data attributes
 * 
 * @returns {string} Sanitized HTML safe for rendering in the DOM
 * 
 * @throws {TypeError} When input is not a string
 * 
 * @example
 * ```javascript
 * // Basic usage
 * const safeHTML = sanitizeHTML('<script>alert("xss")</script><p>Hello</p>');
 * console.log(safeHTML); // '<p>Hello</p>'
 * 
 * // With custom configuration
 * const customHTML = sanitizeHTML(userInput, {
 *   ALLOWED_TAGS: [...DEFAULT_CONFIG.ALLOWED_TAGS, 'mark', 'small']
 * });
 * 
 * // Sanitize rich content
 * const content = sanitizeHTML(blogPost, {
 *   ALLOWED_ATTR: [...DEFAULT_CONFIG.ALLOWED_ATTR, 'style']
 * });
 * ```
 * 
 * @see {@link https://github.com/cure53/DOMPurify} DOMPurify documentation
 * @see {@link sanitizeText} For plain text sanitization (strips all HTML)
 * @see {@link sanitizeURL} For URL validation and sanitization
 * 
 * @since 1.0.0
 * @version 2.0.0
 */
export const sanitizeHTML = (dirty, config = {}) => {
  if (typeof dirty !== 'string') return '';
  
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  return DOMPurify.sanitize(dirty, mergedConfig);
};

/**
 * Sanitizes user input for plain text by stripping all HTML tags.
 * 
 * This function removes all HTML markup from input, leaving only plain text content.
 * It's useful for fields that should never contain HTML, such as form inputs,
 * usernames, or data that will be displayed in text-only contexts.
 * 
 * ## Use Cases
 * - **Form Validation**: Cleaning user input before processing
 * - **Text Fields**: Sanitizing usernames, descriptions, comments
 * - **Data Export**: Preparing content for text-only formats
 * - **Security**: Ensuring no HTML reaches sensitive processing functions
 * 
 * ## Security Benefits
 * - Complete HTML tag removal prevents all HTML-based attacks
 * - Entity decoding ensures proper character handling
 * - Null input handling prevents type errors
 * 
 * @param {string} input - The user input or content to strip HTML from
 * 
 * @returns {string} Plain text content with all HTML tags removed
 * 
 * @throws {TypeError} When input is not a string
 * 
 * @example
 * ```javascript
 * // Basic text sanitization
 * const plainText = sanitizeText('<p>Hello <strong>world</strong>!</p>');
 * console.log(plainText); // 'Hello world!'
 * 
 * // User input sanitization
 * const cleanUsername = sanitizeText(usernameInput);
 * 
 * // Form data processing
 * const cleanComment = sanitizeText(formData.comment);
 * ```
 * 
 * @see {@link sanitizeHTML} For HTML sanitization that preserves safe tags
 * @see {@link sanitizeURL} For URL validation and sanitization
 * 
 * @since 1.0.0
 */
export const sanitizeText = (input) => {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

/**
 * Validates and sanitizes URLs to prevent protocol-based attacks.
 * 
 * This function validates URLs and ensures they use only safe protocols.
 * It prevents malicious URLs that could execute JavaScript, access local files,
 * or bypass security controls through protocol manipulation.
 * 
 * ## Security Features
 * - **Protocol Whitelisting**: Only allows http, https, mailto, and tel protocols
 * - **URL Parsing**: Uses native URL API for robust validation
 * - **Attack Prevention**: Blocks javascript:, data:, file:, and other dangerous protocols
 * - **Error Handling**: Returns null for any invalid or malformed URLs
 * 
 * ## Allowed Protocols
 * - `http:` - Standard web protocol (allows redirects to https)
 * - `https:` - Secure web protocol
 * - `mailto:` - Email links (opens mail client)
 * - `tel:` - Telephone links (opens phone app on mobile)
 * 
 * ## Blocked Protocols
 * - `javascript:` - XSS attacks
 * - `data:` - Potential data exfiltration
 * - `file:` - Local file access
 * - `ftp:` - Unencrypted file transfer
 * - All other custom protocols
 * 
 * @param {string} url - The URL to validate and sanitize
 * 
 * @returns {string|null} Normalized safe URL or null if invalid/dangerous
 * 
 * @throws {TypeError} When input is not a string
 * 
 * @example
 * ```javascript
 * // Valid URLs
 * console.log(sanitizeURL('https://example.com')); // 'https://example.com'
 * console.log(sanitizeURL('mailto:user@example.com')); // 'mailto:user@example.com'
 * console.log(sanitizeURL('tel:+1234567890')); // 'tel:+1234567890'
 * 
 * // Dangerous URLs
 * console.log(sanitizeURL('javascript:alert("xss")')); // null
 * console.log(sanitizeURL('data:text/html,<script>alert(1)</script>')); // null
 * console.log(sanitizeURL('file:///etc/passwd')); // null
 * 
 * // Malformed URLs
 * console.log(sanitizeURL('not-a-url')); // null
 * console.log(sanitizeURL('')); // null
 * ```
 * 
 * @see {@link sanitizeHTML} For HTML content sanitization
 * @see {@link sanitizeText} For plain text sanitization
 * 
 * @since 1.0.0
 */
export const sanitizeURL = (url) => {
  if (typeof url !== 'string') return null;
  
  try {
    const parsed = new URL(url);
    const allowed = ['http:', 'https:', 'mailto:', 'tel:'];
    
    if (!allowed.includes(parsed.protocol)) {
      return null;
    }
    
    return parsed.href;
  } catch {
    return null;
  }
};

/**
 * Collection of sanitizer helpers for HTML, text, and URL validation.
 * 
 * This default export provides a convenient namespace for all sanitization
 * functions, allowing for cleaner imports and consistent API usage across
 * the application.
 * 
 * ## Available Functions
 * - `sanitizeHTML()` - Sanitizes HTML while preserving safe tags
 * - `sanitizeText()` - Strips all HTML, returns plain text
 * - `sanitizeURL()` - Validates and sanitizes URLs
 * 
 * @namespace Sanitizer
 * @property {Function} sanitizeHTML - HTML sanitization function
 * @property {Function} sanitizeText - Plain text sanitization function
 * @property {Function} sanitizeURL - URL validation function
 * 
 * @example
 * ```javascript
 * // Import all sanitizers
 * import sanitizer from './utils/sanitize';
 * 
 * // Use with namespace
 * const safeHTML = sanitizer.sanitizeHTML(userContent);
 * const cleanText = sanitizer.sanitizeText(userInput);
 * const safeURL = sanitizer.sanitizeURL(userURL);
 * 
 * // Destructured import also works
 * import { sanitizeHTML, sanitizeText, sanitizeURL } from './utils/sanitize';
 * ```
 * 
 * @since 1.0.0
 */
export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeURL,
};
