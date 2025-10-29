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

const hasLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
const hasSessionStorage = typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'

class ApiClient {
  constructor() {
    if (hasSessionStorage && window.sessionStorage.getItem('token')) {
      this.token = window.sessionStorage.getItem('token')
    } else if (hasLocalStorage) {
      this.token = window.localStorage.getItem('token')
    } else {
      this.token = null
    }
  }

  setToken(token) {
    this.token = token
    if (!hasSessionStorage && !hasLocalStorage) {
      return
    }
    if (token) {
      // Prefer sessionStorage to avoid persistence across browser restarts
      if (hasSessionStorage) {
        window.sessionStorage.setItem('token', token)
      } else if (hasLocalStorage) {
        window.localStorage.setItem('token', token)
      }
    } else {
      if (hasSessionStorage) {
        window.sessionStorage.removeItem('token')
      }
      if (hasLocalStorage) {
        window.localStorage.removeItem('token')
      }
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

    if (isJsonBody && !config.headers['Content-Type']) {
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
        payload = text ? { message: text } : null
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
}

export const api = new ApiClient()
