import { createContext, useContext, useState, useEffect } from "react"
import PropTypes from "prop-types"
import { api } from "../api/client"

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    
    const checkAuth = async () => {
      try {
        const userData = await api.me({ signal: controller.signal })
        
        if (!controller.signal.aborted) {
          setIsAuthenticated(true)
          setUser(userData)
          setError(null)
        }
      } catch (err) {
        if (!controller.signal.aborted && err?.status !== 401) {
          console.error('Auth check failed:', err)
        }
        
        if (!controller.signal.aborted) {
          setIsAuthenticated(false)
          setUser(null)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
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
      
      if (!response?.user) {
        throw new Error('Ungueltige Antwort vom Server')
      }
      
      api.setToken(response.token ?? null)
      setIsAuthenticated(true)
      setUser(response.user)
      
      return { success: true }
    } catch (err) {
      api.setToken(null)
      setIsAuthenticated(false)
      setUser(null)
      
      const message = err.message || 'Ungueltige Anmeldedaten'
      setError(message)
      
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await api.logout()
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      setIsAuthenticated(false)
      setUser(null)
      api.setToken(null)
      setError(null)
    }
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  
  return context
}
