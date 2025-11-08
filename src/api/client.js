/**
 * Determines and returns the sanitized base URL for API calls.
 * The URL is determined in the following order of precedence:
 * 1. `VITE_API_BASE_URL` environment variable.
 * 2. Dynamically constructed from the browser's current `window.location`.
 * 3. A fallback to `http://localhost:8489/api` for development environments.
 * The function ensures the returned URL does not have a trailing slash.
 * @returns {string} The resolved, sanitized API base URL.
 */
export const getApiBaseUrl = () => {
  // Prefer explicit environment variable
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  }

  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin
    if (origin && (origin.startsWith('http://') || origin.startsWith('https://'))) {
      const baseUrl = typeof import.meta.env.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/'
      try {
        const resolved = new URL(baseUrl || '/', origin)
        const pathname = resolved.pathname.replace(/\/$/, '')
        const apiPath = pathname ? `${pathname}/api` : '/api'
        return `${resolved.origin}${apiPath}`
      } catch (error) {
        console.warn('Failed to resolve BASE_URL for API calls, falling back to origin.', error)
        return `${origin}/api`
      }
    }
  }

  // Safe fallback for development
  return 'http://localhost:8489/api'
}

const API_BASE_URL = getApiBaseUrl()

/**
 * Checks if the provided body is a binary format.
 * This includes Blob, File, ArrayBuffer, ArrayBuffer views, and ReadableStream.
 * @param {*} body The body to check.
 * @returns {boolean} True if the body is a binary format, false otherwise.
 */
const isBinaryBody = (body) => {
  if (!body || typeof body !== 'object') {
    return false
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return true
  }

  if (typeof File !== 'undefined' && body instanceof File) {
    return true
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (body instanceof ArrayBuffer) {
      return true
    }
    if (typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(body)) {
      return true
    }
  }

  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
    return true
  }

  return false
}

const CSRF_COOKIE_NAME = 'ltcms_csrf'
const CSRF_HEADER_NAME = 'x-csrf-token'

const getCsrfToken = () => {
  if (typeof document === 'undefined' || !document.cookie) {
    return null
  }

  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${CSRF_COOKIE_NAME}=`))
    ?.split('=')[1] ?? null
}

/**
 * Manages all communication with the backend API.
 * Provides methods for authentication, tutorials, site content, and more.
 */
class ApiClient {
  /**
   * Initializes a new instance of the ApiClient.
   */
  constructor() {
    /** @private */
    this.token = null
  }

  /**
   * Sets the authentication token.
   * Note: This method is retained for backward compatibility but no longer stores the token
   * as authentication is handled via HttpOnly cookies.
   * @param {string | null} token The JWT token.
   */
  setToken(token) {
    // Tokens are now managed exclusively via HttpOnly cookies.
    // Retain method signature for backwards compatibility without storing client-side state.
    if (token && typeof token !== 'string') {
      console.warn('Attempted to set invalid JWT token; ignoring')
    }
    this.token = null
  }

  /**
   * Gets the default headers for API requests.
   * @returns {Object<string, string>} A headers object.
   * @private
   */
  getHeaders() {
    return {}
  }

  /**
   * Performs an API request.
   * @param {string} endpoint The API endpoint to call.
   * @param {RequestInit & { timeout?: number, cacheBust?: boolean }} options Fetch options and custom settings.
   * @returns {Promise<any>} A promise that resolves with the response data.
   * @throws {Error} Throws an error if the request fails.
   */
  async request(endpoint, options = {}) {
    const {
      timeout = 15000,
      headers: optionHeaders,
      signal: userSignal,
      cacheBust = import.meta.env.VITE_API_CACHE_BUST === 'true',
      ...rest
    } = options

    const method = (rest.method || 'GET').toUpperCase()

    let url = `${API_BASE_URL}${endpoint}`
    if (cacheBust && method === 'GET') {
      const separator = url.includes('?') ? '&' : '?'
      url = `${url}${separator}_ts=${Date.now()}`
    }
    const controller = new AbortController()
    let timeoutId = null
    let cleanedUp = false

    // Cleanup function to prevent memory leaks
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (userSignal) {
        userSignal.removeEventListener('abort', handleAbort)
      }
      controller.abort()
    }

    // Handle both user signal and internal timeout
    const handleAbort = () => controller.abort()
    if (userSignal) {
      userSignal.addEventListener('abort', handleAbort)
    }

    timeoutId = setTimeout(() => {
      controller.abort()
    }, timeout)

    const headers = new Headers()
    const applyHeaders = (source) => {
      if (!source) {
        return
      }
      if (source instanceof Headers) {
        source.forEach((value, key) => headers.set(key, value))
        return
      }
      if (Array.isArray(source)) {
        source.forEach((entry) => {
          if (Array.isArray(entry) && entry.length >= 2) {
            const [key, value] = entry
            if (key) {
              headers.set(key, value)
            }
          }
        })
        return
      }
      Object.entries(source).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          headers.set(key, value)
        }
      })
    }

    applyHeaders(this.getHeaders())
    applyHeaders(optionHeaders)

    const config = {
      ...rest,
      headers,
      signal: controller.signal,
    }

    if (!Object.prototype.hasOwnProperty.call(config, 'credentials')) {
      config.credentials = 'include'
    }

    if (!Object.prototype.hasOwnProperty.call(config, 'cache')) {
      config.cache = 'no-store'
    }

    const bodyCandidate = config.body
    const isJsonBody =
      bodyCandidate &&
      !(bodyCandidate instanceof FormData) &&
      !(bodyCandidate instanceof URLSearchParams) &&
      !isBinaryBody(bodyCandidate) &&
      typeof bodyCandidate === 'object'

    const hasJsonContentType = Array.from(headers.keys()).some(
      (key) => key.toLowerCase() === 'content-type',
    )

    if (isJsonBody && !hasJsonContentType) {
      headers.set('Content-Type', 'application/json')
    }
    if (isJsonBody) {
      config.body = JSON.stringify(bodyCandidate)
    }

    const requiresCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method)
    if (requiresCsrf && !headers.has(CSRF_HEADER_NAME)) {
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        headers.set(CSRF_HEADER_NAME, csrfToken)
      }
    }

    try {
      const response = await fetch(url, config)

      const isEmptyBody =
        response.status === 204 ||
        response.status === 205 ||
        response.headers.get('content-length') === '0'

      if (isEmptyBody) {
        if (!response.ok) {
          const error = new Error(response.statusText || 'Request failed')
          error.status = response.status
          throw error
        }
        cleanup() // Clean up on success
        return null
      }

      const contentType = response.headers.get('content-type') || ''
      let payload

      if (contentType.includes('application/json')) {
        try {
          payload = await response.json()
        } catch (parseError) {
          const error = new Error('Ungültige JSON-Antwort vom Server')
          error.status = response.status
          error.cause = parseError
          throw error
        }
      } else {
        const text = await response.text()
        // Bei HTML-Fehlerseiten (z.B. 502 von nginx) keine lange Fehlermeldung anzeigen
        if (contentType.includes('text/html') && !response.ok) {
          payload = { message: 'Server-Fehler' }
        } else {
          payload = text ? { message: text } : null
        }
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.setToken(null)
        }
        const error = new Error(
          payload?.error || payload?.message || response.statusText || 'Request failed',
        )
        error.status = response.status
        throw error
      }

      cleanup() // Clean up on success
      return payload
    } catch (error) {
      // Clean up on error
      cleanup()
      if (error.name === 'AbortError') {
        const timeoutError = new Error(userSignal?.aborted ? 'Request aborted' : 'Request timed out')
        timeoutError.status = userSignal?.aborted ? 0 : 408
        console.error('API Error:', timeoutError)
        throw timeoutError
      }
      console.error('API Error:', error)
      if (error.status === 401 || error.status === 403) {
        this.setToken(null)
      }
      throw error
    }
  }

  // Auth endpoints
  /**
   * Logs in a user.
   * @param {string} username The user's username.
   * @param {string} password The user's password.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the login response data.
   */
  async login(username, password, options = {}) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: { username, password },
      ...options,
    })
    if (data.token) {
      this.setToken(data.token)
    }
    return data
  }

  /**
   * Logs out the current user.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<void>}
   */
  async logout(options = {}) {
    try {
      await this.request('/auth/logout', { method: 'POST', ...options })
    } finally {
      this.setToken(null)
    }
  }

  /**
   * Fetches the current user's profile.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the user's profile data.
   */
  async me(options = {}) {
    return this.request('/auth/me', options)
  }

  // Tutorial endpoints
  /**
   * Fetches a list of tutorials.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the list of tutorials.
   */
  async getTutorials(options = {}) {
    return this.request('/tutorials', options)
  }

  /**
   * Fetches a single tutorial by its ID.
   * @param {string} id The ID of the tutorial.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the tutorial data.
   */
  async getTutorial(id, options = {}) {
    return this.request(`/tutorials/${id}`, options)
  }

  /**
   * Creates a new tutorial.
   * @param {object} tutorial The tutorial data.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the created tutorial data.
   */
  async createTutorial(tutorial, options = {}) {
    return this.request('/tutorials', {
      method: 'POST',
      body: tutorial,
      ...options,
    })
  }

  /**
   * Updates an existing tutorial.
   * @param {string} id The ID of the tutorial to update.
   * @param {object} tutorial The updated tutorial data.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the updated tutorial data.
   */
  async updateTutorial(id, tutorial, options = {}) {
    return this.request(`/tutorials/${id}`, {
      method: 'PUT',
      body: tutorial,
      ...options,
    })
  }

  /**
   * Deletes a tutorial.
   * @param {string} id The ID of the tutorial to delete.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves when the tutorial is deleted.
   */
  async deleteTutorial(id, options = {}) {
    return this.request(`/tutorials/${id}`, {
      method: 'DELETE',
      ...options,
    })
  }

  /**
   * Lists all comments for a given tutorial.
   * @param {string} tutorialId The ID of the tutorial.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the list of comments.
   */
  async listTutorialComments(tutorialId, options = {}) {
    if (!tutorialId) {
      throw new Error('tutorialId is required')
    }
    const encodedTutorialId = encodeURIComponent(tutorialId)
    return this.request(`/tutorials/${encodedTutorialId}/comments`, options)
  }

  /**
   * Creates a new comment on a tutorial.
   * @param {string} tutorialId The ID of the tutorial.
   * @param {string} content The content of the comment.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the created comment data.
   */
  async createComment(tutorialId, content, options = {}) {
    if (!tutorialId) {
      throw new Error('tutorialId is required')
    }
    const encodedTutorialId = encodeURIComponent(tutorialId)
    return this.request(`/tutorials/${encodedTutorialId}/comments`, {
      method: 'POST',
      body: { content },
      ...options,
    })
  }

  /**
   * Deletes a comment.
   * @param {string} commentId The ID of the comment to delete.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves when the comment is deleted.
   */
  async deleteComment(commentId, options = {}) {
    if (!commentId) {
      throw new Error('commentId is required')
    }
    const encodedCommentId = encodeURIComponent(commentId)
    return this.request(`/comments/${encodedCommentId}`, {
      method: 'DELETE',
      ...options,
    })
  }

  // Site content endpoints
  /**
   * Fetches all site content.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the site content.
   */
  async getSiteContent(options = {}) {
    return this.request('/content', options)
  }

  /**
   * Fetches a specific section of the site content.
   * @param {string} section The name of the content section.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the content section data.
   */
  async getSiteContentSection(section, options = {}) {
    return this.request(`/content/${section}`, options)
  }

  /**
   * Updates a specific section of the site content.
   * @param {string} section The name of the content section to update.
   * @param {string} content The new content.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the updated content section data.
   */
  async updateSiteContentSection(section, content, options = {}) {
    return this.request(`/content/${section}`, {
      method: 'PUT',
      body: { content },
      ...options,
    })
  }

  // Site pages (admin)
  /**
   * Lists all pages (admin).
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the list of pages.
   */
  async listPages(options = {}) {
    return this.request('/pages', options)
  }

  /**
   * Creates a new page (admin).
   * @param {object} payload The page data.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the created page data.
   */
  async createPage(payload, options = {}) {
    return this.request('/pages', {
      method: 'POST',
      body: payload,
      ...options,
    })
  }

  /**
   * Fetches a single page by its ID (admin).
   * @param {string} id The ID of the page.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the page data.
   */
  async getPage(id, options = {}) {
    return this.request(`/pages/${id}`, options)
  }

  /**
   * Updates an existing page (admin).
   * @param {string} id The ID of the page to update.
   * @param {object} payload The updated page data.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the updated page data.
   */
  async updatePage(id, payload, options = {}) {
    return this.request(`/pages/${id}`, {
      method: 'PUT',
      body: payload,
      ...options,
    })
  }

  /**
   * Deletes a page (admin).
   * @param {string} id The ID of the page to delete.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves when the page is deleted.
   */
  async deletePage(id, options = {}) {
    return this.request(`/pages/${id}`, {
      method: 'DELETE',
      ...options,
    })
  }

  // Site posts (admin)
  /**
   * Lists all posts for a given page (admin).
   * @param {string} pageId The ID of the page.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the list of posts.
   */
  async listPosts(pageId, options = {}) {
    return this.request(`/pages/${pageId}/posts`, options)
  }

  /**
   * Creates a new post on a page (admin).
   * @param {string} pageId The ID of the page.
   * @param {object} payload The post data.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the created post data.
   */
  async createPost(pageId, payload, options = {}) {
    return this.request(`/pages/${pageId}/posts`, {
      method: 'POST',
      body: payload,
      ...options,
    })
  }

  /**
   * Fetches a single post by its ID (admin).
   * @param {string} id The ID of the post.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the post data.
   */
  async getPost(id, options = {}) {
    return this.request(`/posts/${id}`, options)
  }

  /**
   * Updates an existing post (admin).
   * @param {string} id The ID of the post to update.
   * @param {object} payload The updated post data.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the updated post data.
   */
  async updatePost(id, payload, options = {}) {
    return this.request(`/posts/${id}`, {
      method: 'PUT',
      body: payload,
      ...options,
    })
  }

  /**
   * Deletes a post (admin).
   * @param {string} id The ID of the post to delete.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves when the post is deleted.
   */
  async deletePost(id, options = {}) {
    return this.request(`/posts/${id}`, {
      method: 'DELETE',
      ...options,
    })
  }

  // Public site pages & navigation
  /**
   * Fetches a published page by its slug.
   * @param {string} slug The slug of the page.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the page data.
   */
  async getPublishedPage(slug, options = {}) {
    return this.request(`/public/pages/${slug}`, options)
  }

  /**
   * Fetches the site's navigation structure.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the navigation data.
   */
  async getNavigation(options = {}) {
    return this.request('/public/navigation', options)
  }

  /**
   * Lists all published pages.
   * @param {RequestInit} [options={}] Additional request options.
   * @returns {Promise<any>} A promise that resolves with the list of published pages.
   */
  async listPublishedPages(options = {}) {
    return this.request('/public/published-pages', options)
  }
}

export const api = new ApiClient()
