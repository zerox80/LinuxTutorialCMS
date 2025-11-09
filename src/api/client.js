
/**
 * Determines the base URL for API requests based on environment configuration.
 * Prioritizes VITE_API_BASE_URL environment variable, then constructs from window.location,
 * and falls back to localhost if neither is available.
 * 
 * @returns {string} The base API URL without trailing slash
 */
export const getApiBaseUrl = () => {

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

  return 'http://localhost:8489/api'
}

const API_BASE_URL = getApiBaseUrl()

/**
 * Checks if a request body is binary data (Blob, File, ArrayBuffer, etc.).
 * 
 * @param {*} body - The request body to check
 * @returns {boolean} True if the body is binary data, false otherwise
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

/**
 * Retrieves the CSRF token from browser cookies.
 * 
 * @returns {string|null} The CSRF token if found, null otherwise
 */
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
 * API client class for making HTTP requests to the backend.
 * Handles authentication, CSRF protection, request timeouts, and error handling.
 */
class ApiClient {
  
  /**
   * Creates a new ApiClient instance.
   * Initializes the authentication token to null.
   */
  constructor() {
    
    this.token = null
  }

  
  /**
   * Sets the authentication token for API requests.
   * Currently disabled for security - tokens are managed via cookies.
   * 
   * @param {string|null} token - The JWT token to set (currently ignored)
   */
  setToken(token) {

    if (token && typeof token !== 'string') {
      console.warn('Attempted to set invalid JWT token; ignoring')
    }
    this.token = null
  }

  
  /**
   * Gets the default headers for API requests.
   * 
   * @returns {Object} Empty object (headers are managed per-request)
   */
  getHeaders() {
    return {}
  }

  
  /**
   * Makes an HTTP request to the API with comprehensive error handling.
   * Handles timeouts, CSRF tokens, JSON serialization, and response parsing.
   * 
   * @param {string} endpoint - The API endpoint path (e.g., '/tutorials')
   * @param {Object} options - Fetch options including method, body, headers, etc.
   * @param {number} [options.timeout=15000] - Request timeout in milliseconds
   * @param {boolean} [options.cacheBust=false] - Whether to add cache-busting timestamp
   * @param {AbortSignal} [options.signal] - Optional abort signal for cancellation
   * @returns {Promise<Object|null>} The parsed response data or null for empty responses
   * @throws {Error} Throws error with status code for failed requests
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
        cleanup()
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

      cleanup()
      return payload
    } catch (error) {

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

  
  /**
   * Authenticates a user with username and password.
   * 
   * @param {string} username - The username for authentication
   * @param {string} password - The password for authentication
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Response containing authentication token and user data
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
   * Logs out the current user and clears authentication token.
   * 
   * @param {Object} [options={}] - Additional request options
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
   * Retrieves the current authenticated user's information.
   * 
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Current user data
   */
  async me(options = {}) {
    return this.request('/auth/me', options)
  }

  
  /**
   * Fetches all tutorials from the API.
   * 
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Array>} Array of tutorial objects
   */
  async getTutorials(options = {}) {
    return this.request('/tutorials', options)
  }

  
  /**
   * Fetches a single tutorial by ID.
   * 
   * @param {string} id - The tutorial ID
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Tutorial object
   */
  async getTutorial(id, options = {}) {
    return this.request(`/tutorials/${id}`, options)
  }

  
  /**
   * Creates a new tutorial.
   * 
   * @param {Object} tutorial - The tutorial data to create
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Created tutorial object
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
   * 
   * @param {string} id - The tutorial ID to update
   * @param {Object} tutorial - The updated tutorial data
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Updated tutorial object
   */
  async updateTutorial(id, tutorial, options = {}) {
    return this.request(`/tutorials/${id}`, {
      method: 'PUT',
      body: tutorial,
      ...options,
    })
  }

  
  /**
   * Deletes a tutorial by ID.
   * 
   * @param {string} id - The tutorial ID to delete
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<void>}
   */
  async deleteTutorial(id, options = {}) {
    return this.request(`/tutorials/${id}`, {
      method: 'DELETE',
      ...options,
    })
  }

  
  /**
   * Lists all comments for a specific tutorial.
   * 
   * @param {string} tutorialId - The tutorial ID to fetch comments for
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Array>} Array of comment objects
   * @throws {Error} If tutorialId is not provided
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
   * 
   * @param {string} tutorialId - The tutorial ID to comment on
   * @param {string} content - The comment text content
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Created comment object
   * @throws {Error} If tutorialId is not provided
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
   * Deletes a comment by ID.
   * 
   * @param {string} commentId - The comment ID to delete
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<void>}
   * @throws {Error} If commentId is not provided
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

  
  /**
   * Fetches all site content sections.
   * 
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Site content data
   */
  async getSiteContent(options = {}) {
    return this.request('/content', options)
  }

  
  /**
   * Fetches a specific site content section.
   * 
   * @param {string} section - The section identifier
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Section content data
   */
  async getSiteContentSection(section, options = {}) {
    return this.request(`/content/${section}`, options)
  }

  
  /**
   * Updates a specific site content section.
   * 
   * @param {string} section - The section identifier to update
   * @param {Object} content - The new content data
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Updated section data
   */
  async updateSiteContentSection(section, content, options = {}) {
    return this.request(`/content/${section}`, {
      method: 'PUT',
      body: { content },
      ...options,
    })
  }

  
  /**
   * Lists all pages in the CMS.
   * 
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Array>} Array of page objects
   */
  async listPages(options = {}) {
    return this.request('/pages', options)
  }

  
  /**
   * Creates a new page in the CMS.
   * 
   * @param {Object} payload - The page data to create
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Created page object
   */
  async createPage(payload, options = {}) {
    return this.request('/pages', {
      method: 'POST',
      body: payload,
      ...options,
    })
  }

  
  /**
   * Fetches a single page by ID.
   * 
   * @param {string} id - The page ID
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Page object
   */
  async getPage(id, options = {}) {
    return this.request(`/pages/${id}`, options)
  }

  
  /**
   * Updates an existing page.
   * 
   * @param {string} id - The page ID to update
   * @param {Object} payload - The updated page data
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Updated page object
   */
  async updatePage(id, payload, options = {}) {
    return this.request(`/pages/${id}`, {
      method: 'PUT',
      body: payload,
      ...options,
    })
  }

  
  /**
   * Deletes a page by ID.
   * 
   * @param {string} id - The page ID to delete
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<void>}
   */
  async deletePage(id, options = {}) {
    return this.request(`/pages/${id}`, {
      method: 'DELETE',
      ...options,
    })
  }

  
  /**
   * Lists all posts for a specific page.
   * 
   * @param {string} pageId - The page ID to fetch posts for
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Array>} Array of post objects
   */
  async listPosts(pageId, options = {}) {
    return this.request(`/pages/${pageId}/posts`, options)
  }

  
  /**
   * Creates a new post under a specific page.
   * 
   * @param {string} pageId - The parent page ID
   * @param {Object} payload - The post data to create
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Created post object
   */
  async createPost(pageId, payload, options = {}) {
    return this.request(`/pages/${pageId}/posts`, {
      method: 'POST',
      body: payload,
      ...options,
    })
  }

  
  /**
   * Fetches a single post by ID.
   * 
   * @param {string} id - The post ID
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Post object
   */
  async getPost(id, options = {}) {
    return this.request(`/posts/${id}`, options)
  }

  
  /**
   * Updates an existing post.
   * 
   * @param {string} id - The post ID to update
   * @param {Object} payload - The updated post data
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Updated post object
   */
  async updatePost(id, payload, options = {}) {
    return this.request(`/posts/${id}`, {
      method: 'PUT',
      body: payload,
      ...options,
    })
  }

  
  /**
   * Deletes a post by ID.
   * 
   * @param {string} id - The post ID to delete
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<void>}
   */
  async deletePost(id, options = {}) {
    return this.request(`/posts/${id}`, {
      method: 'DELETE',
      ...options,
    })
  }

  
  /**
   * Fetches a published page by its slug (public endpoint).
   * 
   * @param {string} slug - The page slug
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Published page object
   */
  async getPublishedPage(slug, options = {}) {
    return this.request(`/public/pages/${slug}`, options)
  }

  
  /**
   * Fetches the site navigation structure (public endpoint).
   * 
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Object>} Navigation data
   */
  async getNavigation(options = {}) {
    return this.request('/public/navigation', options)
  }

  
  /**
   * Lists all published pages (public endpoint).
   * 
   * @param {Object} [options={}] - Additional request options
   * @returns {Promise<Array>} Array of published page objects
   */
  async listPublishedPages(options = {}) {
    return this.request('/public/published-pages', options)
  }
}

export const api = new ApiClient()
