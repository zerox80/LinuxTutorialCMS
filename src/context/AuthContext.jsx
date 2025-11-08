import { createContext, useContext, useState, useEffect } from "react"
import { api } from "../api/client"

const AuthContext = createContext(null)

/**
 * Provides authentication state and functions to its children components.
 * Manages user authentication status, user data, login, and logout operations.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components that need access to the auth context.
 * @returns {JSX.Element} The AuthContext provider.
 */
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

  /**
   * Attempts to authenticate a user with the provided credentials.
   *
   * @param {string} username - The username for authentication.
   * @param {string} password - The password for authentication.
   * @returns {Promise<{success: boolean, error?: string}>} An object indicating success or failure with an optional error message.
   */
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

  /**
   * Logs out the current user and clears authentication state.
   *
   * @returns {Promise<void>}
   */
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

/**
 * Custom hook to access the authentication context.
 *
 * @returns {object} The authentication context value, including `isAuthenticated`, `user`, `login`, `logout`, `loading`, and `error`.
 * @throws {Error} If used outside of an `AuthProvider`.
 */
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}


