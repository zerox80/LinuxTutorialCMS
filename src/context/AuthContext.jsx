import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/client'

const removeTokenFromStorage = () => {
  if (typeof window === 'undefined') return
  window.sessionStorage?.removeItem('token')
  window.localStorage?.removeItem('token')
}

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check if user is already logged in on mount
  useEffect(() => {
    const controller = new AbortController()
    
    const checkAuth = async () => {
      if (typeof window === 'undefined' || !window.localStorage) {
        setLoading(false)
        return
      }
      const token = window.sessionStorage?.getItem('token') ?? window.localStorage.getItem('token')
      if (token) {
        // Basic JWT format validation (should have 3 parts separated by dots)
        const jwtParts = token.split('.')
        if (jwtParts.length !== 3) {
          console.warn('Invalid JWT format in storage, removing token')
          removeTokenFromStorage()
          setLoading(false)
          return
        }
        
        // Check JWT expiration before making API call
        try {
          const base64Url = jwtParts[1]
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
          const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
          const payload = JSON.parse(atob(padded))
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.warn('JWT expired, removing token')
            removeTokenFromStorage()
            setLoading(false)
            return
          }
        } catch (e) {
          console.warn('Failed to parse JWT payload, removing token')
          removeTokenFromStorage()
          setLoading(false)
          return
        }
        
        try {
          api.setToken(token)
          const userData = await api.me({ signal: controller.signal })
          if (!controller.signal.aborted) {
            setIsAuthenticated(true)
            setUser(userData)
            setError(null)
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error('Auth check failed:', error)
            removeTokenFromStorage()
            api.setToken(null)
            setIsAuthenticated(false)
            setUser(null)
            // Don't set error here as it's just an expired/invalid token
          }
        }
      }
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
    checkAuth()
    
    return () => {
      controller.abort()
    }
  }, [])

  const login = async (username, password) => {
    try {
      setError(null)
      setLoading(true)

      const sanitizedUsername = username.trim()
      const response = await api.login(sanitizedUsername, password)

      if (!response?.token || !response?.user) {
        throw new Error('Ungültige Antwort vom Server')
      }

      api.setToken(response.token)
      setIsAuthenticated(true)
      setUser(response.user)
      return { success: true }
    } catch (error) {
      api.setToken(null)
      setIsAuthenticated(false)
      setUser(null)
      const message = error.message || 'Ungültige Anmeldedaten'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUser(null)
    api.setToken(null)
    setError(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
