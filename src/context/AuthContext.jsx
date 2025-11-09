/**
 * Authentication Context Module
 * 
 * Provides centralized authentication state management for the entire application.
 * Handles user login, logout, session persistence, and authentication checks.
 * 
 * Features:
 * - Automatic authentication check on mount
 * - Session persistence with token management
 * - Error handling and loading states
 * - Abort controller for cleanup on unmount
 * 
 * @module AuthContext
 */

// Import React hooks for context creation and state management
import { createContext, useContext, useState, useEffect } from "react"

// Import PropTypes for runtime type checking of component props
import PropTypes from "prop-types"

// Import API client for authentication-related HTTP requests
import { api } from "../api/client"

/**
 * Authentication Context
 * 
 * React context that holds authentication state and methods.
 * Initialized as null and populated by AuthProvider.
 * 
 * @type {React.Context<AuthContextValue|null>}
 */
const AuthContext = createContext(null)
/**
 * Authentication Provider Component
 * 
 * Wraps the application to provide authentication context to all child components.
 * Manages authentication state, user data, and provides login/logout methods.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to wrap with auth context
 * @returns {JSX.Element} Provider component with authentication context
 */
export const AuthProvider = ({ children }) => {
  // Track whether user is currently authenticated
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  // Store current user data (username, roles, etc.)
  const [user, setUser] = useState(null)
  
  // Track loading state during authentication operations
  const [loading, setLoading] = useState(true)
  
  // Store any authentication errors (login failures, network errors, etc.)
  const [error, setError] = useState(null)
  /**
   * Effect: Check authentication status on component mount
   * 
   * Automatically verifies if user has a valid session when the app loads.
   * Uses AbortController to prevent state updates if component unmounts during request.
   * 
   * Flow:
   * 1. Create abort controller for request cancellation
   * 2. Call API to verify current session
   * 3. Update auth state based on response
   * 4. Clean up by aborting request on unmount
   */
  useEffect(() => {
    // Create AbortController to cancel request if component unmounts
    const controller = new AbortController()
    
    /**
     * Async function to check current authentication status
     * Calls /api/me endpoint to verify session validity
     */
    const checkAuth = async () => {
      try {
        // Fetch current user data from backend with abort signal
        const userData = await api.me({ signal: controller.signal })
        
        // Only update state if request wasn't aborted (component still mounted)
        if (!controller.signal.aborted) {
          setIsAuthenticated(true)  // Mark user as authenticated
          setUser(userData)          // Store user data
          setError(null)             // Clear any previous errors
        }
      } catch (err) {
        // Log error only if not aborted and not a 401 (unauthorized)
        // 401 is expected when user is not logged in
        if (!controller.signal.aborted && err?.status !== 401) {
          console.error('Auth check failed:', err)
        }
        
        // Update state to reflect unauthenticated status
        if (!controller.signal.aborted) {
          setIsAuthenticated(false)  // Mark user as not authenticated
          setUser(null)              // Clear user data
        }
      } finally {
        // Always stop loading indicator when check completes
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }
    
    // Execute authentication check
    checkAuth()
    
    // Cleanup function: abort request if component unmounts
    return () => {
      controller.abort()
    }
  }, [])  // Empty dependency array - run only on mount
  /**
   * Login Function
   * 
   * Authenticates user with username and password.
   * Updates authentication state and stores session token on success.
   * 
   * @param {string} username - User's username
   * @param {string} password - User's password
   * @returns {Promise<{success: boolean, error?: string}>} Login result
   */
  const login = async (username, password) => {
    try {
      // Clear any previous errors
      setError(null)
      
      // Show loading indicator during login attempt
      setLoading(true)
      
      // Sanitize username by removing leading/trailing whitespace
      const sanitizedUsername = username.trim()
      
      // Call API login endpoint with credentials
      const response = await api.login(sanitizedUsername, password)
      
      // Validate response contains user data
      if (!response?.user) {
        throw new Error('Ungueltige Antwort vom Server')  // Invalid server response
      }
      
      // Store authentication token for subsequent API requests
      api.setToken(response.token ?? null)
      
      // Update authentication state
      setIsAuthenticated(true)   // Mark user as authenticated
      setUser(response.user)     // Store user data
      
      // Return success result
      return { success: true }
    } catch (err) {
      // Clear token and auth state on login failure
      api.setToken(null)          // Remove any stored token
      setIsAuthenticated(false)   // Mark user as not authenticated
      setUser(null)               // Clear user data
      
      // Extract error message or use default
      const message = err.message || 'Ungueltige Anmeldedaten'  // Invalid credentials
      setError(message)           // Store error for display
      
      // Return failure result with error message
      return { success: false, error: message }
    } finally {
      // Always hide loading indicator when login attempt completes
      setLoading(false)
    }
  }
  /**
   * Logout Function
   * 
   * Logs out the current user and clears all authentication state.
   * Calls backend logout endpoint and clears local session data.
   * 
   * @returns {Promise<void>}
   */
  const logout = async () => {
    try {
      // Call backend logout endpoint to invalidate session
      await api.logout()
    } catch (err) {
      // Log error but continue with local cleanup
      // User should be logged out locally even if backend call fails
      console.error('Logout failed:', err)
    } finally {
      // Always clear authentication state (even if API call fails)
      setIsAuthenticated(false)   // Mark user as not authenticated
      setUser(null)               // Clear user data
      api.setToken(null)          // Remove stored token
      setError(null)              // Clear any errors
    }
  }
  /**
   * Render Provider
   * 
   * Provides authentication context value to all child components.
   * Value includes state (isAuthenticated, user, loading, error) and methods (login, logout).
   */
  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}
// PropTypes validation for AuthProvider component
AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,  // Child components to wrap with auth context
}
/**
 * useAuth Hook
 * 
 * Custom hook to access authentication context.
 * Must be used within AuthProvider component tree.
 * 
 * @returns {AuthContextValue} Authentication context value
 * @throws {Error} If used outside AuthProvider
 * 
 * @example
 * const { isAuthenticated, user, login, logout } = useAuth()
 */
export const useAuth = () => {
  // Get authentication context
  const context = useContext(AuthContext)
  
  // Throw error if hook is used outside AuthProvider
  // This helps catch developer errors early
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  
  // Return context value with auth state and methods
  return context
}
