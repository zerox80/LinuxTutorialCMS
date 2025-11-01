// Validate and sanitize API base URL
const getApiBaseUrl = () => {
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
        return `${resolved.origin}${pathname}/api`.replace(/\/+$/, '/api')
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

const isLikelyJwt = (token) => {
  if (typeof token !== 'string') return false
  const parts = token.split('.')
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

class ApiClient {
  constructor() {
    this.token = null
  }

  setToken(token) {
    if (token && !isLikelyJwt(token)) {
      console.warn('Attempted to set invalid JWT token; ignoring')
      this.token = null
      return
    }
    this.token = token || null
  }

  getHeaders() {
    const headers = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  async request(endpoint, options = {}) {
    const {
      timeout = 15000,
      headers: optionHeaders,
      signal: userSignal,
      cacheBust = true,
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

  async logout(options = {}) {
    try {
      await this.request('/auth/logout', { method: 'POST', ...options })
    } finally {
      this.setToken(null)
    }
  }

  async me(options = {}) {
    return this.request('/auth/me', options)
  }

  // Tutorial endpoints
  async getTutorials(options = {}) {
    return this.request('/tutorials', options)
  }

  async getTutorial(id, options = {}) {
    return this.request(`/tutorials/${id}`, options)
  }

  async createTutorial(tutorial, options = {}) {
    return this.request('/tutorials', {
      method: 'POST',
      body: tutorial,
      ...options,
    })
  }

  async updateTutorial(id, tutorial, options = {}) {
    return this.request(`/tutorials/${id}`, {
      method: 'PUT',
      body: tutorial,
      ...options,
    })
  }

  async deleteTutorial(id, options = {}) {
    return this.request(`/tutorials/${id}`, {
      method: 'DELETE',
      ...options,
    })
  }

  // Site content endpoints
  async getSiteContent(options = {}) {
    return this.request('/content', options)
  }

  async getSiteContentSection(section, options = {}) {
    return this.request(`/content/${section}`, options)
  }

  async updateSiteContentSection(section, content, options = {}) {
    return this.request(`/content/${section}`, {
      method: 'PUT',
      body: { content },
      ...options,
    })
  }

  // Site pages (admin)
  async listPages(options = {}) {
    return this.request('/pages', options)
  }

  async createPage(payload, options = {}) {
    return this.request('/pages', {
      method: 'POST',
      body: payload,
      ...options,
    })
  }

  async getPage(id, options = {}) {
    return this.request(`/pages/${id}`, options)
  }

  async updatePage(id, payload, options = {}) {
    return this.request(`/pages/${id}`, {
      method: 'PUT',
      body: payload,
      ...options,
    })
  }

  async deletePage(id, options = {}) {
    return this.request(`/pages/${id}`, {
      method: 'DELETE',
      ...options,
    })
  }

  // Site posts (admin)
  async listPosts(pageId, options = {}) {
    return this.request(`/pages/${pageId}/posts`, options)
  }

  async createPost(pageId, payload, options = {}) {
    return this.request(`/pages/${pageId}/posts`, {
      method: 'POST',
      body: payload,
      ...options,
    })
  }

  async getPost(id, options = {}) {
    return this.request(`/posts/${id}`, options)
  }

  async updatePost(id, payload, options = {}) {
    return this.request(`/posts/${id}`, {
      method: 'PUT',
      body: payload,
      ...options,
    })
  }

  async deletePost(id, options = {}) {
    return this.request(`/posts/${id}`, {
      method: 'DELETE',
      ...options,
    })
  }

  // Public site pages & navigation
  async getPublishedPage(slug, options = {}) {
    return this.request(`/public/pages/${slug}`, options)
  }

  async getNavigation(options = {}) {
    return this.request('/public/navigation', options)
  }

  async listPublishedPages(options = {}) {
    return this.request('/public/published-pages', options)
  }
}

export const api = new ApiClient()
