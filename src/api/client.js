const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:8489/api')

const hasStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

class ApiClient {
  constructor() {
    this.token = hasStorage ? localStorage.getItem('token') : null
  }

  setToken(token) {
    this.token = token
    if (!hasStorage) {
      return
    }
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
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
    const { timeout = 15000, headers: optionHeaders, signal, ...rest } = options
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const config = {
      ...rest,
      headers: {
        ...this.getHeaders(),
        ...optionHeaders,
      },
      signal: signal || controller.signal,
    }

    if (config.body && !config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json'
    }

    try {
      const response = await fetch(url, config)
      clearTimeout(timeoutId)

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
        return null
      }

      const contentType = response.headers.get('content-type') || ''
      let payload

      if (contentType.includes('application/json')) {
        payload = await response.json()
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

      return payload
    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        error = new Error('Request timed out')
        error.status = 408
      }
      console.error('API Error:', error)
      throw error
    }
  }

  // Auth endpoints
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (data.token) {
      this.setToken(data.token)
    }
    return data
  }

  async me() {
    return this.request('/auth/me')
  }

  // Tutorial endpoints
  async getTutorials() {
    return this.request('/tutorials')
  }

  async getTutorial(id) {
    return this.request(`/tutorials/${id}`)
  }

  async createTutorial(tutorial) {
    return this.request('/tutorials', {
      method: 'POST',
      body: JSON.stringify(tutorial),
    })
  }

  async updateTutorial(id, tutorial) {
    return this.request(`/tutorials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tutorial),
    })
  }

  async deleteTutorial(id) {
    return this.request(`/tutorials/${id}`, {
      method: 'DELETE',
    })
  }
}

export const api = new ApiClient()
