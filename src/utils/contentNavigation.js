import { scrollToSection } from './scrollToSection'
import { sanitizeExternalUrl } from './urlValidation'

/**
 * @fileoverview Content Navigation Utilities
 *
 * This module provides utilities for handling different types of content navigation
 * within the Linux Tutorial CMS. It supports navigation between sections, routes,
 * pages, external URLs, and anchor links with proper security validation.
 *
 * Features:
 * - Section ID normalization and validation
 * - Page path building from multiple input formats
 * - Secure external URL handling with XSS prevention
 * - Integration with React Router for client-side navigation
 * - Smooth scrolling to page sections
 *
 * Security Considerations:
 * - All external URLs are validated through sanitizeExternalUrl()
 * - Prevents navigation to malicious protocols
 * - Uses secure window.open() with noopener,noreferrer
 *
 * Browser Compatibility:
 * - Requires modern browser with URL constructor support
 * - Uses window.open() for external links (may be blocked by popup blockers)
 * - Depends on scrollToSection utility for smooth scrolling
 *
 * Performance:
 * - Minimal overhead with simple string operations
 * - Early returns for invalid inputs to avoid unnecessary processing
 * - No heavy computations or DOM queries in helper functions
 *
 * @version 1.0.0
 * @since 2024
 * @author LinuxTutorialCMS Team
 */

/**
 * Normalizes a section ID value to a clean string for navigation.
 * Handles various input types and formats, ensuring valid section identifiers.
 *
 * @function normalizeSectionId
 * @param {*} value - Value to normalize (string, number, or other types)
 * @returns {string} Normalized section ID or empty string if invalid
 *
 * @example
 * // String input
 * normalizeSectionId('tutorial-basics') // Returns: 'tutorial-basics'
 * normalizeSectionId('  advanced-topics  ') // Returns: 'advanced-topics'
 *
 * // Number input
 * normalizeSectionId(42) // Returns: '42'
 *
 * // Invalid input
 * normalizeSectionId(null) // Returns: ''
 * normalizeSectionId({}) // Returns: ''
 * normalizeSectionId(undefined) // Returns: ''
 *
 * @see {@link scrollToSection} for the actual scrolling implementation
 * @see {@link navigateContentTarget} for usage in navigation
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
 * Builds a consistent page path from various value formats and sources.
 * Supports direct paths, slugs, and objects containing path information.
 * Ensures proper URL structure for CMS pages.
 *
 * @function buildPagePath
 * @param {string|Object} value - Page slug, path, or object containing slug/path/value
 * @param {string} [value.slug] - Page slug when value is an object
 * @param {string} [value.path] - Page path when value is an object
 * @param {string} [value.value] - Page value when value is an object
 * @returns {string|null} Built page path in format '/pages/{slug}' or null if invalid
 *
 * @example
 * // Direct string input
 * buildPagePath('linux-basics') // Returns: '/pages/linux-basics'
 * buildPagePath('/already/absolute') // Returns: '/already/absolute'
 *
 * // Object input
 * buildPagePath({ slug: 'advanced-linux' }) // Returns: '/pages/advanced-linux'
 * buildPagePath({ path: 'file-permissions' }) // Returns: '/pages/file-permissions'
 * buildPagePath({ value: 'shell-scripting' }) // Returns: '/pages/shell-scripting'
 *
 * // Edge cases
 * buildPagePath('') // Returns: null
 * buildPagePath(null) // Returns: null
 * buildPagePath({}) // Returns: null
 * buildPagePath({ invalidProp: 'test' }) // Returns: null
 *
 * @throws {TypeError} If value type is unsupported (handled gracefully)
 *
 * @see {@link navigateContentTarget} for usage in page navigation
 * @see {@link https://reactrouter.com/en/main} React Router documentation
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
 * Navigates to a content target based on its type with comprehensive security validation.
 * Supports sections, routes, pages, external URLs, and hrefs with appropriate
 * handling for each navigation type.
 *
 * @function navigateContentTarget
 * @param {Object} target - Navigation target object containing type and destination
 * @param {string} target.type - Target type ('section', 'route', 'page', 'external', 'href')
 * @param {*} [target.value] - Target value (section ID, route path, URL, etc.)
 * @param {*} [target.path] - Alternative path property for navigation
 * @param {*} [target.href] - Alternative href property for navigation
 * @param {Object} [options={}] - Navigation options and callbacks
 * @param {Function} [options.navigate] - React Router navigate function for client-side routing
 * @param {Object} [options.location] - React Router location object for current route info
 *
 * @returns {void} Function performs navigation action but doesn't return a value
 *
 * @throws {Error} May throw errors from underlying navigation functions (caught by callers)
 *
 * @example
 * // Navigate to a section on current page
 * navigateContentTarget(
 *   { type: 'section', value: 'tutorial-basics' },
 *   { navigate: useNavigate(), location: useLocation() }
 * )
 *
 * // Navigate to a route
 * navigateContentTarget(
 *   { type: 'route', value: '/admin/dashboard' },
 *   { navigate: useNavigate() }
 * )
 *
 * // Navigate to a CMS page
 * navigateContentTarget(
 *   { type: 'page', value: 'linux-commands' },
 *   { navigate: useNavigate() }
 * )
 *
 * // Navigate to external website (safely)
 * navigateContentTarget(
 *   { type: 'external', value: 'https://kernel.org' }
 * )
 *
 * // Navigate to anchor link
 * navigateContentTarget(
 *   { type: 'href', value: '#getting-started' }
 * )
 *
 * @example
 * // Integration with React Router
 * import { useNavigate, useLocation } from 'react-router-dom'
 *
 * function NavigationComponent({ target }) {
 *   const navigate = useNavigate()
 *   const location = useLocation()
 *
 *   const handleNavigate = () => {
 *     navigateContentTarget(target, { navigate, location })
 *   }
 *
 *   return <button onClick={handleNavigate}>Go to Target</button>
 * }
 *
 * Security Features:
 * - All external URLs are validated through sanitizeExternalUrl()
 * - Uses secure window.open() with 'noopener,noreferrer' to prevent tabnabbing
 * - Blocks unsafe navigation attempts with console warnings
 * - Server-side rendering safe (checks for window object)
 *
 * Browser Compatibility:
 * - Requires window object for external/href navigation
 * - Uses scrollToSection for smooth scrolling (may require polyfills in older browsers)
 * - React Router integration works in all supported browsers
 *
 * Performance Considerations:
 * - Early returns for invalid inputs to avoid unnecessary processing
 * - Minimal DOM manipulation (only when scrolling)
 * - Efficient string operations for path building
 *
 * @see {@link normalizeSectionId} for section ID processing
 * @see {@link buildPagePath} for page path construction
 * @see {@link scrollToSection} for smooth scrolling implementation
 * @see {@link sanitizeExternalUrl} for URL security validation
 * @see {@link https://reactrouter.com/en/main/hooks/use-navigate} React Router navigate hook
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
