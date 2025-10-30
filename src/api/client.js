// Validate and sanitize API base URL
const getApiBaseUrl = () => {
  // Prefer explicit environment variable
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  
  // Fallback to window.location.origin with validation
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin
    // Validate origin starts with http:// or https://
    if (origin && (origin.startsWith('http://') || origin.startsWith('https://'))) {
      return `${origin}/api`
    }
  }
  
  // Safe fallback for development
  return 'http://localhost:8489/api'
}

const API_BASE_URL = getApiBaseUrl()

const hasSessionStorage = typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
const hasLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const readStoredToken = () => {
  if (typeof window === 'undefined') return null

  const stored = hasSessionStorage && window.sessionStorage.getItem('token')
  if (stored) return stored

  const local = hasLocalStorage && window.localStorage.getItem('token')
  return local || null
}

const removeStoredToken = () => {
  if (typeof window === 'undefined') return
  if (hasSessionStorage) {
    window.sessionStorage.removeItem('token')
  }
  if (hasLocalStorage) {
    window.localStorage.removeItem('token')
  }
}

const isLikelyJwt = (token) => {
  if (typeof token !== 'string') return false
  const parts = token.split('.')
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

class ApiClient {
  constructor() {
    const stored = readStoredToken()
    this.token = isLikelyJwt(stored) ? stored : null
    if (stored && !this.token) {
      removeStoredToken()
    }
  }

  setToken(token) {
    this.token = token
    if (!hasSessionStorage && !hasLocalStorage) {
      return
    }
    if (token) {
      if (!isLikelyJwt(token)) {
        console.warn('Attempted to store invalid JWT token; ignoring')
        return
      }
      // Prefer sessionStorage to avoid persistence across browser restarts
      if (hasSessionStorage) {
        window.sessionStorage.setItem('token', token)
      }
      if (hasLocalStorage) {
        window.localStorage.setItem('token', token)
      }
    } else {
      removeStoredToken()
    }
  }

  getHeaders() {
    const headers = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    const { timeout = 15000, headers: optionHeaders, signal: userSignal, ...rest } = options
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

    const config = {
      ...rest,
      headers: {
        ...this.getHeaders(),
        ...optionHeaders,
      },
      signal: controller.signal,
    }

    const isJsonBody =
      config.body &&
      !(config.body instanceof FormData) &&
      !(config.body instanceof URLSearchParams) &&
      typeof config.body === 'object'

    const hasJsonContentType = Object.keys(config.headers).some(
      (key) => key.toLowerCase() === 'content-type',
    )

    if (isJsonBody && !hasJsonContentType) {
      config.headers['Content-Type'] = 'application/json'
      config.body = JSON.stringify(config.body)
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
