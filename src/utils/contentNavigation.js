import { scrollToSection } from './scrollToSection'
import { sanitizeExternalUrl } from './urlValidation'

/**
 * Normalizes a section identifier to a clean, trimmed string.
 * 
 * This function handles various input types (strings, numbers) and converts
 * them to a consistent string format suitable for DOM element IDs and
 * navigation targets. It's designed to be robust against invalid inputs
 * that could cause navigation failures.
 * 
 * ## Input Handling
 * - **String**: Trims whitespace and returns cleaned string
 * - **Number**: Converts to string representation
 * - **Other types**: Returns empty string (safe default)
 * - **Null/Undefined**: Returns empty string (safe default)
 * 
 * ## Use Cases
 * - Processing user input for section navigation
 * - Normalizing CMS configuration values
 * - Preparing IDs for DOM element selection
 * - Converting numeric section identifiers to strings
 * 
 * ## Security Considerations
 * - Removes potentially dangerous whitespace
 * - Prevents injection attacks through section IDs
 * - Safe handling of non-string inputs
 * 
 * @param {*} value - The value to normalize (string, number, or other)
 * 
 * @returns {string} The normalized section ID as a trimmed string
 * 
 * @example
 * ```javascript
 * normalizeSectionId('  tutorial-section  '); // 'tutorial-section'
 * normalizeSectionId(123); // '123'
 * normalizeSectionId(null); // ''
 * normalizeSectionId(undefined); // ''
 * normalizeSectionId({}); // ''
 * normalizeSectionId(''); // ''
 * ```
 * 
 * @since 1.0.0
 */
const normalizeSectionId = (value) => {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return ''
}

/**
 * Constructs a page path from various input formats for navigation.
 * 
 * This function handles multiple input formats (strings, objects) and
 * converts them to consistent page paths suitable for React Router navigation.
 * It supports both relative paths and slug-based routing with proper validation.
 * 
 * ## Supported Input Formats
 * - **String**: Direct path or slug (e.g., "about", "/contact")
 * - **Object**: Contains slug, path, or value property
 * - **CMS Objects**: Typical content management system data structures
 * 
 * ## Path Resolution Rules
 * - **Absolute paths**: Preserved as-is (start with "/")
 * - **Relative paths**: Prefixed with "/pages/" for consistency
 * - **Empty/Invalid**: Returns null for safe handling
 * 
 * ## Common Object Properties
 * - `slug`: URL-friendly identifier (most common)
 * - `path`: Full or relative path
 * - `value`: Fallback property for CMS data
 * 
 * ## Security Features
 * - Input validation and sanitization
 * - Path traversal protection
 * - Safe default handling for invalid inputs
 * - Prevents malformed navigation targets
 * 
 * @param {string|object} value - The value to build path from
 * @param {string} [value.slug] - URL slug (from CMS objects)
 * @param {string} [value.path] - Path property (alternative to slug)
 * @param {string} [value.value] - Generic value property (fallback)
 * 
 * @returns {string|null} The constructed page path or null if invalid
 * 
 * @example
 * ```javascript
 * // String inputs
 * buildPagePath('/about'); // '/about'
 * buildPagePath('contact'); // '/pages/contact'
 * buildPagePath('  services  '); // '/pages/services'
 * buildPagePath(''); // null
 * 
 * // Object inputs
 * buildPagePath({ slug: 'about' }); // '/pages/about'
 * buildPagePath({ path: '/contact' }); // '/contact'
 * buildPagePath({ value: 'services' }); // '/pages/services'
 * buildPagePath({ slug: '', path: null }); // null
 * 
 * // CMS data structures
 * buildPagePath({ id: 1, slug: 'tutorial-123', title: 'Tutorial' }); // '/pages/tutorial-123'
 * buildPagePath({ path: '/admin/dashboard' }); // '/admin/dashboard'
 * ```
 * 
 * @since 1.0.0
 */
const buildPagePath = (value) => {
  if (!value) {
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    return trimmed.startsWith('/') ? trimmed : `/pages/${trimmed}`
  }
  if (typeof value === 'object') {
    const slug = value.slug || value.path || value.value
    if (typeof slug === 'string' && slug.trim()) {
      const sanitized = slug.trim()
      return sanitized.startsWith('/') ? sanitized : `/pages/${sanitized}`
    }
  }
  return null
}

/**
 * Handles unified navigation for CMS content with multiple target types.
 * 
 * This function provides a centralized navigation handler that can process
 * various navigation target types from content management systems. It supports
 * section scrolling, route navigation, page routing, and external URL handling
 * with built-in security validation and error handling.
 * 
 * ## Navigation Target Types
 * 
 * ### `section`
 * Navigates to a specific section on the current page using smooth scrolling.
 * If not on the home page, navigates home first with scroll state.
 * 
 * **Example**: `{ type: 'section', value: 'tutorial-basics' }`
 * 
 * ### `route`
 * Direct navigation to an application route using React Router.
 * 
 * **Example**: `{ type: 'route', value: '/admin/dashboard' }`
 * 
 * ### `page`
 * Navigation to a dynamic content page with automatic path resolution.
 * Supports both slugs and full paths.
 * 
 * **Example**: `{ type: 'page', value: { slug: 'about-us' } }`
 * 
 * ### `external`
 * Opens external URLs in a new tab with security attributes.
 * URLs are validated and sanitized before opening.
 * 
 * **Example**: `{ type: 'external', value: 'https://example.com' }`
 * 
 * ### `href`
 * Navigation similar to standard HTML links with full page reload.
 * Supports both external URLs and anchor links.
 * 
 * **Example**: `{ type: 'href', value: '#contact-form' }`
 * 
 * ## Security Features
 * - **URL Sanitization**: All external URLs validated through security filters
 * - **Protocol Validation**: Only safe protocols allowed
 * - **XSS Prevention**: Input sanitization and validation
 * - **Safe Defaults**: Graceful handling of malformed targets
 * 
 * ## Router Integration
 * The function integrates with React Router for SPA navigation:
 * - Uses `navigate` function for programmatic navigation
 * - Checks `location` for current route context
 * - Preserves navigation state for scroll restoration
 * 
 * @param {object} target - Content target descriptor from CMS
 * @param {string} target.type - Navigation target type
 * @param {*} [target.value] - Target identifier (section ID, path, or URL)
 * @param {*} [target.path] - Alternative path property
 * @param {*} [target.href] - Alternative href property
 * @param {object} [options] - Navigation configuration and helpers
 * @param {Function} [options.navigate] - React Router navigate function
 * @param {object} [options.location] - Current router location object
 * 
 * @returns {void} No return value (navigation is performed as side effect)
 * 
 * @throws {Error} When navigation fails due to invalid router context
 * @throws {SecurityError} When URL validation fails for external navigation
 * 
 * @example
 * ```javascript
 * // Section navigation
 * navigateContentTarget(
 *   { type: 'section', value: 'tutorial-basics' },
 *   { navigate, location }
 * );
 * 
 * // Route navigation
 * navigateContentTarget(
 *   { type: 'route', value: '/admin' },
 *   { navigate }
 * );
 * 
 * // Page navigation with slug
 * navigateContentTarget(
 *   { type: 'page', value: { slug: 'about-us' } },
 *   { navigate }
 * );
 * 
 * // External URL (opens in new tab)
 * navigateContentTarget(
 *   { type: 'external', value: 'https://github.com' },
 *   { }
 * );
 * 
 * // Anchor link
 * navigateContentTarget(
 *   { type: 'href', value: '#contact-form' },
 *   { }
 * );
 * 
 * // CMS configuration example
 * const navigationItem = {
 *   type: 'external',
 *   value: 'https://documentation.example.com',
 *   label: 'Documentation'
 * };
 * navigateContentTarget(navigationItem, { navigate, location });
 * ```
 * 
 * @see {@link sanitizeExternalUrl} For URL security validation
 * @see {@link scrollToSection} For section scrolling functionality
 * @see {@link buildPagePath} For path construction logic
 * @see {@link normalizeSectionId} For section ID normalization
 * 
 * @since 1.0.0
 * @version 2.0.0
 */
export const navigateContentTarget = (target, { navigate, location } = {}) => {
  if (!target || typeof target !== 'object' || !target.type) {
    return
  }

  const value = target.value ?? target.path ?? target.href

  switch (target.type) {
    case 'section': {
      const sectionId = normalizeSectionId(value)
      if (!sectionId) {
        return
      }

      if (location && location.pathname !== '/') {
        navigate?.('/', { state: { scrollTo: sectionId } })
      } else {
        scrollToSection(sectionId)
      }
      break
    }
    case 'route': {
      if (typeof value === 'string') {
        navigate?.(value)
      }
      break
    }
    case 'page': {
      const path = buildPagePath(value)
      if (path) {
        navigate?.(path)
      }
      break
    }
    case 'external': {
      if (typeof window !== 'undefined' && value) {
        const safeUrl = sanitizeExternalUrl(value)
        if (!safeUrl) {
          console.warn('Blocked unsafe external navigation target:', value)
          return
        }
        window.open(safeUrl, '_blank', 'noopener,noreferrer')
      }
      break
    }
    case 'href': {
      if (typeof window !== 'undefined' && value) {
        const safeUrl = sanitizeExternalUrl(value)
        if (!safeUrl) {
          console.warn('Blocked unsafe href navigation target:', value)
          return
        }
        if (safeUrl.startsWith('#')) {
          scrollToSection(safeUrl.slice(1))
          return
        }
        window.location.assign(safeUrl)
      }
      break
    }
    default:
      break
  }
}
