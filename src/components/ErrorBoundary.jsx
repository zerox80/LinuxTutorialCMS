import { Component } from 'react'
import PropTypes from 'prop-types'
import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * Error boundary component that catches and displays React errors gracefully.
 * Provides a user-friendly error UI with reset functionality.
 */
class ErrorBoundary extends Component {
  
  /**
   * Creates an ErrorBoundary instance.
   * 
   * @param {Object} props - Component props
   */
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  
  /**
   * Updates state when an error is caught.
   * 
   * @param {Error} error - The error that was thrown
   * @returns {Object} Updated state with hasError flag
   */
  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  
  /**
   * Logs error details when an error is caught.
   * 
   * @param {Error} error - The error that was thrown
   * @param {Object} errorInfo - Additional error information including component stack
   */
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo,
    })
  }

  
  /**
   * Resets the error state and navigates to home page.
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  
  /**
   * Renders either the error UI or children components.
   * 
   * @returns {JSX.Element} Error UI if error occurred, otherwise children
   */
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">
              Oops! Etwas ist schiefgelaufen
            </h1>
            
            <p className="text-gray-600 text-center mb-6">
              Die Anwendung ist auf einen unerwarteten Fehler gestoßen. 
              Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.
            </p>

            {this.state.error && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-mono text-gray-700 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

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
