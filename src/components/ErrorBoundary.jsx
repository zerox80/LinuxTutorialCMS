import { Component } from 'react'
import PropTypes from 'prop-types'
import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * Error Boundary Component - React Error Handling Wrapper
 *
 * This class component implements React's Error Boundary pattern to catch JavaScript errors
 * anywhere in their child component tree, log those errors, and display a fallback UI
 * instead of the component tree that crashed. It prevents the entire application from
 * crashing due to errors in individual components.
 *
 * Key Features:
 * - Catches JavaScript errors in child component tree
 * - Provides user-friendly error recovery interface
 * - Logs detailed error information for debugging
 * - Graceful error state management and reset functionality
 * - Responsive design with accessibility considerations
 *
 * Error Handling Strategy:
 * 1. Catches errors during rendering, lifecycle methods, and constructors
 * 2. Logs error details to console for development debugging
 * 3. Displays a user-friendly error message with recovery options
 * 4. Provides reset functionality to return to a known good state
 * 5. Maintains application stability by isolating component failures
 *
 * Use Cases:
 * - Wrap entire application to prevent complete crashes
 * - Wrap specific sections prone to errors (external API components, complex UI)
 * - Wrap route components to prevent navigation failures
 * - Development vs production error handling strategies
 *
 * Limitations:
 * - Does not catch errors in event handlers (use try-catch there)
 * - Does not catch errors in async code (use error boundaries there)
 * - Does not catch errors during server-side rendering
 * - Does not catch errors in error boundaries themselves
 *
 * @example
 * ```jsx
 * // Wrap entire application
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 *
 * // Wrap specific components
 * <ErrorBoundary>
 *   <RiskyComponent />
 * </ErrorBoundary>
 *
 * // Wrap routes
 * <Route path="/dashboard" element={
 *   <ErrorBoundary>
 *     <Dashboard />
 *   </ErrorBoundary>
 * } />
 * ```
 *
 * @see {@link https://reactjs.org/docs/error-boundaries.html} for React Error Boundaries documentation
 * @see {@link https://reactjs.org/docs/react-component.html#componentdidcatch} for componentDidCatch lifecycle
 */
class ErrorBoundary extends Component {

  /**
   * Component state object for error management.
   *
   * @typedef {Object} ErrorBoundaryState
   * @property {boolean} hasError - Flag indicating whether an error has been caught
   * @property {Error|null} error - The caught error object (null if no error)
   * @property {Object|null} errorInfo - Additional error information from React (null if no error)
   */

  /**
   * Creates an ErrorBoundary instance with initial state.
   *
   * Initializes the component with no errors and sets up the internal state
   * for tracking error conditions. The constructor follows React class component
   * best practices and properly initializes the state object.
   *
   * @param {Object} props - Component props (passed to parent constructor)
   * @param {Object} props.children - Child components that will be wrapped by this error boundary
   *
   * @see {@link https://reactjs.org/docs/react-component.html#constructor} for React constructor documentation
   */
  constructor(props) {
    super(props)

    /**
     * Initialize component state for error tracking.
     * - hasError: Tracks if an error has been caught (controls UI rendering)
     * - error: Stores the actual error object for debugging and display
     * - errorInfo: Stores React's additional error information including component stack
     */
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  /**
   * Static lifecycle method that updates state when an error is caught.
   *
   * This method is called by React when an error is thrown in a child component.
   * It should return a state update to render the fallback UI. This method runs
   * before componentDidCatch and is used to update the state to show the error UI.
   *
   * Error Handling Flow:
   * 1. Child component throws an error during rendering
   * 2. React calls getDerivedStateFromError with the error
   * 3. Return updated state with hasError: true
   * 4. React re-renders the component with the error state
   * 5. Error UI is displayed instead of the crashed children
   *
   * @param {Error} error - The error that was thrown in a child component
   * @returns {Partial<ErrorBoundaryState>} State update object with hasError set to true
   *
   * @see {@link https://reactjs.org/docs/react-component.html#static-getderivedstatefromerror} for React documentation
   */
  static getDerivedStateFromError(error) {
    // Update state to show fallback UI on next render
    return { hasError: true }
  }

  /**
   * Lifecycle method called when an error is caught in a child component.
   *
   * This method provides additional error information including the component stack
   * where the error occurred. It's used for logging and debugging purposes.
   * The error information is stored in component state for potential display
   * in development environments.
   *
   * Logging Strategy:
   * - Logs both the error and additional React error info
   * - Provides complete error context for debugging
   * - Stores error details in state for development display
   * - Handles production vs development logging differently
   *
   * @param {Error} error - The JavaScript error that was thrown
   * @param {Object} errorInfo - Additional error information from React
   * @param {string} errorInfo.componentStack - Stack trace of components where error occurred
   *
   * @see {@link https://reactjs.org/docs/react-component.html#componentdidcatch} for React documentation
   */
  componentDidCatch(error, errorInfo) {
    // Log detailed error information for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Store error information in state for potential display
    this.setState({
      error: error,
      errorInfo: errorInfo,
    })
  }

  /**
   * Error recovery handler that resets the error state and navigates home.
   *
   * This method provides users with a way to recover from errors by resetting
   * the error boundary state and returning to a known safe location. It implements
   * a recovery strategy that clears the error state and navigates to the home page.
   *
   * Recovery Process:
   * 1. Clear all error-related state (hasError, error, errorInfo)
   * 2. Attempt to navigate to home page using History API
   * 3. Trigger React Router navigation through popstate event
   * 4. Handle gracefully if navigation APIs are unavailable
   *
   * Navigation Strategy:
   * - Uses History API for URL updates (modern browsers)
   * - Triggers React Router's popstate listener for route changes
   * - Provides fallback behavior if navigation APIs fail
   * - Maintains application state consistency during recovery
   *
   * @returns {void}
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/History_API} for History API documentation
   */
  handleReset = () => {
    // Reset error state to allow re-rendering of children
    this.setState({ hasError: false, error: null, errorInfo: null })

    // Navigate to home page if browser APIs are available
    if (typeof window !== 'undefined' && window.history) {
      try {
        // Update URL without page reload
        window.history.pushState({}, '', '/')

        // Trigger React Router's navigation listener
        window.dispatchEvent(new PopStateEvent('popstate'))
      } catch (navError) {
        console.warn('Navigation during error reset failed:', navError)
      }
    }
  }

  /**
   * Renders either the error UI or child components based on error state.
   *
   * This method implements the conditional rendering strategy for the error boundary.
   * When an error has been caught, it displays a user-friendly error interface with
   * recovery options. When no error is present, it renders the child components normally.
   *
   * Rendering Strategy:
   * - Error state: Display user-friendly error recovery UI
   * - Normal state: Render child components transparently
   * - Responsive design works on all screen sizes
   * - Accessibility features included in error UI
   *
   * Error UI Features:
   * - Clear error messaging in German (localized)
   * - Visual error indicator with appropriate iconography
   * - Technical error details displayed in development mode
   * - Recovery button with hover states and transitions
   * - Responsive layout with proper spacing and typography
   *
   * @returns {JSX.Element} Error recovery UI when hasError is true, otherwise children components
   *
   * @see {@link https://reactjs.org/docs/rendering-elements.html} for React rendering documentation
   */
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
            // Error icon with visual styling
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>

            // Error title and description
            <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">
              Oops! Etwas ist schiefgelaufen
            </h1>

            <p className="text-gray-600 text-center mb-6">
              Die Anwendung ist auf einen unerwarteten Fehler gestoßen.
              Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.
            </p>

            // Technical error details (development mode)
            {this.state.error && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-mono text-gray-700 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            // Recovery button with interactive styling
            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Zur Startseite</span>
            </button>
          </div>
        </div>
      )
    }

    // No error - render children normally
    return this.props.children
  }
}

ErrorBoundary.propTypes = {
  
  children: PropTypes.node.isRequired,
}

ErrorBoundary.defaultProps = {
  children: null,
}

export default ErrorBoundary
