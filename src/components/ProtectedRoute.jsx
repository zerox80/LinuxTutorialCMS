import { Navigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { useAuth } from '../context/AuthContext'

/**
 * Authentication guard component that protects routes from unauthenticated access.
 *
 * This component serves as a security wrapper for authenticated routes by:
 * - Verifying user authentication status using the AuthContext
 * - Redirecting unauthenticated users to the login page
 * - Displaying a loading state during authentication verification
 * - Preventing access to sensitive application areas
 *
 * This is essential for protecting admin routes, user dashboards, and any
 * pages that require authentication before access.
 *
 * @example
 * ```jsx
 * // Protect admin routes
 * <ProtectedRoute>
 *   <AdminDashboard />
 * </ProtectedRoute>
 *
 * // Protect user-specific routes
 * <ProtectedRoute>
 *   <UserProfile />
 * </ProtectedRoute>
 *
 * // In router configuration
 * <Route
 *   path="/admin/*"
 *   element={
 *     <ProtectedRoute>
 *       <AdminRoutes />
 *     </ProtectedRoute>
 *   }
 * />
 * ```
 *
 * @component
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - The child components/routes to render if authenticated.
 * @returns {JSX.Element | null} Loading indicator during auth check, redirect if unauthenticated, or children if authenticated.
 *
 * @since 1.0.0
 * @version 1.0.0
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Laden...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

ProtectedRoute.propTypes = {
  /** React node(s) to render when user is authenticated */
  children: PropTypes.node.isRequired,
}

export default ProtectedRoute
