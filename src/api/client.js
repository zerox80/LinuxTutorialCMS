const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:8489/api')

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('token')
  }

  setToken(token) {
    this.token = token
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    }

    try {
      const response = await fetch(url, config)
      
      if (response.status === 204) {
        return null
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Request failed')
      }

      return data
    } catch (error) {
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
