/**
 * @fileoverview Input Sanitization Utilities
 *
 * This module provides comprehensive input sanitization functionality for the
 * Linux Tutorial CMS. It uses DOMPurify to prevent XSS attacks and ensure
 * safe handling of user-generated content.
 *
 * Features:
 * - HTML sanitization with configurable allowed tags and attributes
 * - Text sanitization for plain content
 * - URL validation and sanitization
 * - XSS prevention through whitelist-based filtering
 * - Configurable security policies
 *
 * Security Considerations:
 * - Whitelist-based approach (secure by default)
 * - Prevention of XSS and injection attacks
 * - Safe handling of user-generated content
 * - Protection against malicious script execution
 * - URL validation to prevent unsafe redirects
 *
 * Performance:
 * - Efficient DOMPurify integration
 * - Configurable sanitization levels
 * - Minimal overhead for clean content
 * - Optimized for high-volume content processing
 *
 * Browser Compatibility:
 * - DOMPurify dependency with broad browser support
 * - Modern JavaScript features (ES2018+)
 * - Works in all environments with DOM support
 *
 * @version 1.0.0
 * @since 2024
 * @author LinuxTutorialCMS Team
 * @see {@link https://github.com/cure53/DOMPurify} DOMPurify documentation
 * @see {@link https://owasp.org/www-project-cheat-sheets/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html} XSS Prevention
 */

import DOMPurify from 'dompurify';

/**
 * Default configuration for HTML sanitization.
 * Provides secure baseline with commonly needed tags and attributes.
 *
 * @type {Object}
 * @readonly
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
 * Sanitizes HTML content to prevent XSS and injection attacks.
 * Uses DOMPurify with configurable security policies.
 *
 * @function sanitizeHTML
 * @param {string} dirty - HTML content to sanitize
 * @param {Object} [config={}] - Sanitization configuration options
 * @returns {string} Sanitized safe HTML content
 *
 * @example
 * // Basic usage
 * const safeHTML = sanitizeHTML('<script>alert("xss")</script><p>Safe content</p>');
 * // Returns: '<p>Safe content</p>'
 *
 * // Custom configuration
 * const customHTML = sanitizeHTML(userInput, {
 *   ALLOWED_TAGS: ['p', 'strong', 'em'],
 *   ALLOWED_ATTR: ['class']
 * });
 *
 * Security Features:
 * - Removes all scripts and event handlers
 * - Validates and sanitizes all HTML elements
 * - Prevents protocol-based attacks
 * - Handles malformed HTML gracefully
 *
 * @see {@link https://github.com/cure53/DOMPurify#can-i-configure-dompurify} DOMPurify configuration
 */
export const sanitizeHTML = (dirty, config = {}) => {
  if (typeof dirty !== 'string') return '';

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  return DOMPurify.sanitize(dirty, mergedConfig);
};

/**
 * Sanitizes plain text content by removing all HTML tags.
 * Provides text-only output with complete HTML removal.
 *
 * @function sanitizeText
 * @param {string} input - Text content to sanitize
 * @returns {string} Plain text with all HTML removed
 *
 * @example
 * const cleanText = sanitizeText('<p>Hello <strong>world</strong>!</p>');
 * // Returns: 'Hello world!'
 *
 * @example
 * // Safe for displaying user input in text contexts
 * const username = sanitizeText(userInput);
 * <span>{username}</span>
 */
export const sanitizeText = (input) => {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

/**
 * Sanitizes and validates URLs for safe use in links and redirects.
 * Prevents dangerous protocols and validates URL structure.
 *
 * @function sanitizeURL
 * @param {string} url - URL to sanitize and validate
 * @returns {string|null} Sanitized safe URL or null if invalid
 *
 * @example
 * const safeURL = sanitizeURL('https://example.com');
 * // Returns: 'https://example.com'
 *
 * const badURL = sanitizeURL('javascript:alert("xss")');
 * // Returns: null
 *
 * Security Features:
 * - Protocol validation against allowed list
 * - URL structure validation
 * - Prevention of XSS through URLs
 * - Safe error handling
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

export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeURL,
};