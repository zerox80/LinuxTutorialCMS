import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/client'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      if (token) {
        try {
          api.setToken(token)
          const userData = await api.me()
          setIsAuthenticated(true)
          setUser(userData)
        } catch (error) {
          console.error('Auth check failed:', error)
          localStorage.removeItem('token')
          api.setToken(null)
        }
      }
      setLoading(false)
    }
    checkAuth()
  }, [])

  const login = async (username, password) => {
    try {
      const response = await api.login(username, password)
      if (response.token) {
        api.setToken(response.token)
      }
      setIsAuthenticated(true)
      setUser(response.user)
      return { success: true }
    } catch (error) {
      api.setToken(null)
      setIsAuthenticated(false)
      setUser(null)
      return { success: false, error: error.message || 'Ungültige Anmeldedaten' }
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUser(null)
    api.setToken(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading }}>
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
