import { Component } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * A React component that catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */
class ErrorBoundary extends Component {
  /**
   * Creates the error boundary with initial error state.
   *
   * @param {object} props - React component props.
   */
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  /**
   * Updates component state when a child throws to trigger the fallback UI.
   *
   * @param {Error} error - The error thrown by a descendant.
   * @returns {{ hasError: boolean }} State patch instructing React to render the fallback.
   */
  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  /**
   * Lifecycle hook for logging and storing details about caught errors.
   *
   * @param {Error} error - The runtime error that was intercepted.
   * @param {React.ErrorInfo} errorInfo - Component stack information for debugging.
   * @returns {void}
   */
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo,
    })
  }

  /**
   * Clears the error state and navigates the user back to the home page.
   *
   * @returns {void}
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  /**
   * Renders either the fallback interface or the wrapped children tree.
   *
   * @returns {React.ReactNode} The rendered fallback UI or original children.
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

export default ErrorBoundary
