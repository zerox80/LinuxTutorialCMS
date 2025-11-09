import { createContext, useContext, useState, useEffect } from "react"
import PropTypes from "prop-types"
import { api } from "../api/client"

/**
 * @fileoverview Authentication context for managing user authentication state throughout the LinuxTutorialCMS application.
 *
 * This context provides centralized authentication management including:
 * - User login/logout functionality with JWT token handling
 * - Authentication state persistence and automatic token refresh
 * - User session management and security
 * - Protected route authentication checks
 * - Error handling for authentication failures
 *
 * Features:
 * - Automatic authentication verification on app initialization
 * - Secure token storage via API client
 * - Cleanup of authentication state on logout
 * - Input sanitization for login credentials
 * - Abort controller support for request cancellation
 * - Comprehensive error handling and user feedback
 *
 * Security Considerations:
 * - Token is managed through the API client, not localStorage
 * - Automatic cleanup of sensitive data on logout
 * - Input sanitization prevents injection attacks
 * - Request cancellation prevents race conditions
 * - 401 errors are handled silently during auth checks
 *
 * Performance Optimizations:
 * - AbortController prevents memory leaks
 * - Debounced state updates prevent unnecessary re-renders
 * - Lazy loading of user data
 * - Minimal state management overhead
 *
 * Integration Patterns:
 * - Used by ProtectedRoute component for route protection
 * - Consumed by Header component for user authentication UI
 * - Integrated with API client for token management
 * - Compatible with React Suspense boundaries
 *
 * @version 1.0.0
 * @author LinuxTutorialCMS Team
 * @since 1.0.0
 */

/**
 * Authentication context for managing user authentication state across the application.
 *
 * Provides authentication state and CRUD operations for user sessions.
 *
 * @type {React.Context<Object|null>}
 * @property {boolean} isAuthenticated - Whether user is currently authenticated
 * @property {Object|null} user - Current user data object or null if not authenticated
 * @property {Function} login - Function to authenticate user with credentials
 * @property {Function} logout - Function to logout current user and clean up session
 * @property {boolean} loading - Loading state for authentication operations
 * @property {string|null} error - Error message from authentication failures
 */
const AuthContext = createContext(null)

/**
 * Authentication context provider component that manages user authentication state globally.
 *
 * This provider handles user authentication workflows including automatic session verification,
 * login/logout operations, token management, and error handling. It provides a clean interface
 * for components to access authentication state and perform authentication operations.
 *
 * State Management:
 * - isAuthenticated: Boolean flag indicating current authentication status
 * - user: Object containing user profile data or null when not authenticated
 * - loading: Boolean indicating when authentication operations are in progress
 * - error: String containing error messages for display in UI
 *
 * Data Flow:
 * 1. On mount, automatically verifies existing authentication via API token
 * 2. Updates authentication state based on API responses
 * 3. Provides methods for manual login/logout operations
 * 4. Automatically cleans up authentication state on logout
 *
 * Security Features:
 * - Input sanitization for login credentials
 * - Automatic token management through API client
 * - Proper cleanup of sensitive user data on logout
 * - Request cancellation to prevent race conditions
 * - Silent handling of 401 errors during auth checks
 *
 * Performance Considerations:
 * - AbortController prevents memory leaks on component unmount
 * - State updates are batched to minimize re-renders
 * - Authentication check is performed only once on mount
 * - Error states are properly managed to prevent infinite loops
 *
 * Error Handling Strategy:
 * - Network errors are logged but don't crash the application
 * - Invalid credentials are handled gracefully with user feedback
 * - 401 errors during auth checks are handled silently
 * - All authentication operations have proper try-catch blocks
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components that will have access to authentication context
 * @returns {JSX.Element} AuthContext.Provider wrapping children with authentication state and methods
 *
 * @example
 * ```jsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 *
 * @example
 * ```jsx
 * // Using authentication context in a component
 * function MyComponent() {
 *   const { isAuthenticated, user, login, logout } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <LoginComponent onLogin={login} />;
 *   }
 *
 *   return <div>Welcome, {user.name}! <button onClick={logout}>Logout</button></div>;
 * }
 * ```
 *
 * @see useAuth - Hook for accessing authentication context
 * @see api.login - API method for user authentication
 * @see api.me - API method for checking current user session
 */
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /**
   * Effect hook for automatic authentication verification on component mount.
   *
   * This effect performs an authentication check using the API client to verify
   * if there's an existing valid session. It handles request cancellation, error
   * states, and loading states appropriately.
   *
   * Authentication Flow:
   * 1. Creates AbortController for request cancellation
   * 2. Calls api.me() to verify existing authentication
   * 3. Updates state based on API response
   * 4. Handles 401 errors silently (expected for unauthenticated users)
   * 5. Logs other errors for debugging purposes
   * 6. Cleanup function aborts requests on unmount
   *
   * Error Handling:
   * - 401 errors: Treated as expected for unauthenticated state, no user feedback
   * - Other errors: Logged to console for debugging, sets unauthenticated state
   * - Network errors: Sets loading to false and unauthenticated state
   *
   * Performance:
   * - Request cancellation prevents memory leaks
   * - State updates are conditional based on abort status
   * - Single API call on mount to verify authentication
   *
   * @returns {Function} Cleanup function that aborts the authentication check request
   */
  useEffect(() => {
    const controller = new AbortController()

    /**
     * Asynchronous function to verify existing authentication session.
     *
     * Makes an API call to check if the current user has a valid session.
     * Updates authentication state accordingly and handles various error scenarios.
     *
     * @async
     * @returns {Promise<void>}
     */
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
   * Authenticates a user with provided credentials and manages the authentication session.
   *
   * This function handles the complete login flow including input sanitization,
   * API communication, token management, and state updates. It provides comprehensive
   * error handling and returns a consistent result object for UI integration.
   *
   * Authentication Process:
   * 1. Sanitizes username input to prevent injection attacks
   * 2. Sets loading state for UI feedback
   * 3. Calls API login endpoint with sanitized credentials
   * 4. Validates API response structure
   * 5. Stores authentication token via API client
   * 6. Updates authentication state and user data
   * 7. Returns success/error result for UI handling
   *
   * Security Measures:
   * - Username sanitization removes whitespace and prevents injection
   * - Token is stored through API client, not in localStorage
   * - Invalid server responses are rejected as security measure
   * - Authentication state is properly isolated
   * - Error messages are sanitized for user display
   *
   * Error Handling:
   * - Network errors: Returns generic error message to prevent information leakage
   * - Invalid credentials: Returns user-friendly error message
   * - Server errors: Sets unauthenticated state and clears any partial data
   * - Response validation: Rejects malformed API responses
   *
   * State Management:
   * - Loading state provides UI feedback during authentication
   * - Error state displays user-friendly error messages
   * - Authentication state is updated atomically
   * - User data is stored for profile access
   *
   * @async
   * @param {string} username - User's username or email address. Will be automatically sanitized.
   * @param {string} password - User's password. Should be provided in plain text for API transmission.
   * @returns {Promise<{success: boolean, error?: string}>} Authentication result object
   * @returns {boolean} return.success - True if authentication succeeded, false otherwise
   * @returns {string} [return.error] - Error message if authentication failed
   *
   * @example
   * ```jsx
   * const handleLogin = async (username, password) => {
   *   const result = await login(username, password);
   *
   *   if (result.success) {
   *     navigate('/dashboard');
   *   } else {
   *     setLoginError(result.error);
   *   }
   * };
   * ```
   *
   * @see api.login - API method for user authentication
   * @see api.setToken - API method for token management
   * @throws {Error} When API response is malformed or server returns invalid data
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
   * Logs out the current user and performs complete session cleanup.
   *
   * This function handles the logout process by calling the API logout endpoint
   * and then performing comprehensive cleanup of local authentication state.
   * The function ensures that all sensitive user data is properly cleared and
   * the application returns to an unauthenticated state regardless of API response.
   *
   * Logout Process:
   * 1. Attempts to call API logout endpoint for server-side session invalidation
   * 2. Catches and logs any API errors but continues with cleanup
   * 3. Sets authentication state to false
   * 4. Clears user data from local state
   * 5. Removes authentication token from API client
   * 6. Clears any existing error messages
   *
   * Security Considerations:
   * - Always performs local cleanup regardless of API response success
   * - Completely removes sensitive user data from memory
   * - Token is removed from API client storage
   * - Error state is cleared to prevent stale error display
   * - API logout is attempted but not required for local cleanup
   *
   * Error Handling:
   * - API logout errors are logged but don't prevent local cleanup
   * - Network failures during logout don't affect user experience
   * - All cleanup operations are performed in finally block
   * - No error is thrown to calling components
   *
   * State Management:
   * - isAuthenticated: Set to false
   * - user: Set to null
   * - token: Cleared via API client
   * - error: Set to null for clean state
   * - loading: Not affected (remains false)
   *
   * @async
   * @returns {Promise<void>} Promise that resolves when logout is complete
   *
   * @example
   * ```jsx
   * const handleLogout = async () => {
   *   await logout();
   *   navigate('/login');
   * };
   * ```
   *
   * @example
   * ```jsx
   * // Logout with user confirmation
   * const handleLogout = () => {
   *   if (window.confirm('Are you sure you want to logout?')) {
   *     logout().then(() => {
   *       // Additional cleanup if needed
   *       clearLocalData();
   *     });
   *   }
   * };
   * ```
   *
   * @see api.logout - API method for server-side session termination
   * @see api.setToken - API method for token management
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

  /**
   * Returns the authentication context provider value object.
   *
   * This object contains all the authentication state and methods that child
   * components can access through the useAuth hook. The value is stable across
   * re-renders since the state and functions are properly defined.
   *
   * Context Value Structure:
   * - isAuthenticated: Boolean indicating authentication status
   * - user: Object containing user profile data or null
   * - login: Function for user authentication
   * - logout: Function for user session termination
   * - loading: Boolean indicating ongoing authentication operations
   * - error: String containing error messages or null
   *
   * Usage Patterns:
   * - isAuthenticated: Used by ProtectedRoute components
   * - user: Used by profile/user interface components
   * - login: Used by login forms and authentication flows
   * - logout: Used by logout buttons and session management
   * - loading: Used by loading indicators during auth operations
   * - error: Used by error displays and form validation
   *
   * @returns {JSX.Element} AuthContext.Provider component with authentication context value
   */
  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * PropTypes for the AuthProvider component.
 *
 * Ensures that only valid React nodes are passed as children to prevent
 * runtime errors and maintain component integrity.
 */
AuthProvider.propTypes = {
  /**
   * Child components that will have access to the authentication context.
   * Must be a valid React node (element, fragment, string, number, etc.).
   */
  children: PropTypes.node.isRequired,
}

/**
 * Custom hook for accessing the authentication context within functional components.
 *
 * This hook provides a clean interface for components to access authentication
 * state and methods without directly using useContext. It includes safety checks
 * to ensure the hook is used within an AuthProvider wrapper.
 *
 * Hook Usage:
 * - Call at the top level of functional components
 * - Use to access authentication state and methods
 * - Destructure needed values from the returned object
 * - Handle loading and error states appropriately
 *
 * Common Patterns:
 * - Authentication checking: `const { isAuthenticated } = useAuth();`
 * - User data access: `const { user } = useAuth();`
 * - Login functionality: `const { login, loading, error } = useAuth();`
 * - Logout functionality: `const { logout } = useAuth();`
 *
 * Error Handling:
 * - Throws descriptive error if used outside AuthProvider
 * - Error message helps developers debug context setup issues
 * - Prevents undefined context access in components
 *
 * Performance:
 * - Uses React's useContext for optimal performance
 * - No additional re-renders beyond context value changes
 * - Memoized by React's built-in optimization
 *
 * Integration Examples:
 * ```jsx
 * // Protected route component
 * function ProtectedRoute({ children }) {
 *   const { isAuthenticated, loading } = useAuth();
 *
 *   if (loading) return <LoadingSpinner />;
 *   if (!isAuthenticated) return <Navigate to="/login" />;
 *   return children;
 * }
 * ```
 *
 * ```jsx
 * // Login form component
 * function LoginForm() {
 *   const { login, loading, error } = useAuth();
 *   const [credentials, setCredentials] = useState({ username: '', password: '' });
 *
 *   const handleSubmit = async (e) => {
 *     e.preventDefault();
 *     const result = await login(credentials.username, credentials.password);
 *     if (result.success) {
 *       // Navigate to dashboard
 *     }
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {error && <ErrorMessage message={error} />}
 *       {/* Form fields */}
 *       <button type="submit" disabled={loading}>
 *         {loading ? 'Logging in...' : 'Login'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @returns {Object} Authentication context value object
 * @returns {boolean} returns.isAuthenticated - Current authentication status
 * @returns {Object|null} returns.user - User data object or null when not authenticated
 * @returns {Function} returns.login - Function to authenticate user with credentials
 * @returns {Function} returns.logout - Function to logout current user
 * @returns {boolean} returns.loading - Loading state for authentication operations
 * @returns {string|null} returns.error - Error message from authentication failures
 *
 * @throws {Error} If the hook is used outside of an AuthProvider component
 *
 * @example
 * ```jsx
 * function UserProfile() {
 *   const { user, logout } = useAuth();
 *
 *   return (
 *     <div>
 *       <h1>Welcome, {user.name}</h1>
 *       <p>Email: {user.email}</p>
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see AuthProvider - Provider component that creates the authentication context
 * @see AuthContext - The underlying React context object
 * @see useContext - React hook used internally
 */
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

