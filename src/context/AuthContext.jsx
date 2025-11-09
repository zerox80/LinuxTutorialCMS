import { createContext, useContext, useState, useEffect } from "react"
import PropTypes from "prop-types"
import { api } from "../api/client"

const AuthContext = createContext(null)

/**
 * Authentication context provider for managing user authentication state and operations.
 *
 * This context provider offers comprehensive authentication functionality including:
 * - Automatic authentication verification on app initialization
 * - Secure login/logout operations with token management
 * - User session persistence and state management
 * - Loading and error state handling
 * - Automatic cleanup and memory leak prevention
 * - Token-based authentication with proper storage
 *
 * The provider integrates with the API client to handle all authentication
 * requests and maintains state across the entire application.
 *
 * @example
 * ```jsx
 * // Wrap your application with the AuthProvider
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <Router>
 *         <Routes>
 *           <Route path="/admin" element={
 *             <ProtectedRoute>
 *               <AdminDashboard />
 *             </ProtectedRoute>
 *           } />
 *         </Routes>
 *       </Router>
 *     </AuthProvider>
 *   );
 * }
 *
 * // Use authentication in components
 * function LoginComponent() {
 *   const { login, loading, error } = useAuth();
 *   // ... component logic
 * }
 * ```
 *
 * @component
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components that need access to auth state.
 * @returns {JSX.Element} AuthContext provider wrapping children with authentication functionality.
 *
 * @since 1.0.0
 * @version 1.0.0
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

AuthProvider.propTypes = {
  /** React node(s) that will have access to the authentication context */
  children: PropTypes.node.isRequired,
}

/**
 * Custom hook to access the authentication context throughout the application.
 *
 * This hook provides easy access to all authentication functionality including:
 * - Current authentication status
 * - User information and profile data
 * - Login and logout operations
 * - Loading and error states
 *
 * Must be used within a component wrapped by AuthProvider.
 *
 * @example
 * ```jsx
 * // Check authentication status
 * function ProtectedComponent() {
 *   const { isAuthenticated, user, loading } = useAuth();
 *
 *   if (loading) return <Spinner />;
 *   if (!isAuthenticated) return <LoginPrompt />;
 *
 *   return <div>Welcome, {user.username}!</div>;
 * }
 *
 * // Handle login
 * function LoginForm() {
 *   const { login, error, loading } = useAuth();
 *
 *   const handleSubmit = async (credentials) => {
 *     const result = await login(credentials.username, credentials.password);
 *     if (!result.success) {
 *       // Handle login error
 *     }
 *   };
 * }
 * ```
 *
 * @returns {object} Authentication context value containing:
 *                  - isAuthenticated {boolean}: Current authentication status
 *                  - user {object|null}: Current user data or null if not authenticated
 *                  - login {Function}: Login function accepting (username, password)
 *                  - logout {Function}: Logout function to end current session
 *                  - loading {boolean}: Loading state for async operations
 *                  - error {string|null}: Error message or null if no error
 *
 * @throws {Error} If used outside of an AuthProvider wrapper component.
 *
 * @since 1.0.0
 * @version 1.0.0
 */
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}


