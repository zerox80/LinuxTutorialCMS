import DOMPurify from 'dompurify';

// Configure DOMPurify for safe HTML sanitization
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
 * Sanitizes HTML content to prevent XSS attacks
 * @param {string} dirty - The potentially unsafe HTML
 * @param {object} config - Optional DOMPurify configuration
 * @returns {string} - Safe HTML
 */
export const sanitizeHTML = (dirty, config = {}) => {
  if (typeof dirty !== 'string') return '';
  
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  return DOMPurify.sanitize(dirty, mergedConfig);
};

/**
 * Sanitizes user input for plain text (strips all HTML)
 * @param {string} input - The user input
 * @returns {string} - Plain text without HTML
 */
export const sanitizeText = (input) => {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

/**
 * Validates and sanitizes URLs
 * @param {string} url - The URL to validate
 * @returns {string|null} - Safe URL or null if invalid
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
