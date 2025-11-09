// External library imports
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom' // React Router for client-side routing
import { HelmetProvider } from 'react-helmet-async' // For managing document head tags and SEO

// Context provider imports for global state management
import { AuthProvider } from './context/AuthContext' // Authentication state management
import { ContentProvider } from './context/ContentContext' // Content data management
import { TutorialProvider } from './context/TutorialContext' // Tutorial-specific state management
import { ThemeProvider } from './context/ThemeContext' // Theme and UI appearance management

// Component imports
import ErrorBoundary from './components/ErrorBoundary' // Error handling wrapper component
import Header from './components/Header' // Site navigation header
import Footer from './components/Footer' // Site footer
import ProtectedRoute from './components/ProtectedRoute' // Route protection for authenticated users

// Page component imports
import Home from './pages/Home' // Landing/home page
import Grundlagen from './pages/Grundlagen' // Linux basics page
import Login from './pages/Login' // User authentication page
import TutorialDetail from './pages/TutorialDetail' // Individual tutorial view
import DynamicPage from './pages/DynamicPage' // CMS-driven dynamic pages
import PostDetail from './pages/PostDetail' // Individual blog post view
import AdminDashboard from './pages/AdminDashboard' // Admin control panel

/**
 * The main application component.
 *
 * This component sets up the application's routing, context providers, and overall layout.
 * It uses a collection of providers (`HelmetProvider`, `ThemeProvider`, `Router`, `AuthProvider`,
 * `ContentProvider`, `TutorialProvider`) to manage application-wide state and functionality.
 * The component also defines the routes for all pages, including public routes, login,
 * and a protected admin dashboard.
 *
 * @returns {JSX.Element} The rendered application.
 */
function App() {
  return (
    // Main error boundary to catch any unhandled errors in the entire app
    <ErrorBoundary>
      {/* Helmet provider for managing document head tags and SEO meta information */}
      <HelmetProvider>
        {/* Theme provider for dark/light mode and overall styling */}
        <ThemeProvider>
          {/* React Router for client-side routing and navigation */}
          <Router>
            {/* Authentication provider for user login state and sessions */}
            <AuthProvider>
              {/* Content provider for CMS content and page data */}
              <ContentProvider>
                {/* Tutorial provider for tutorial-specific state and data */}
                <TutorialProvider>
                  {/* Main application container with responsive gradient background */}
                  <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors">
                    <Routes>
                      {/* Public Routes with Header & Footer */}
                      {/* Home page route - landing page with full layout */}
                      <Route
                        path="/"
                        element={
                          <ErrorBoundary>
                            <Header />
                            <Home />
                            <Footer />
                          </ErrorBoundary>
                        }
                      />

                      {/* Linux basics page route */}
                      <Route
                        path="/grundlagen"
                        element={
                          <ErrorBoundary>
                            <Header />
                            <Grundlagen />
                            <Footer />
                          </ErrorBoundary>
                        }
                      />

                      {/* Individual tutorial page with dynamic ID parameter */}
                      <Route
                        path="/tutorials/:id"
                        element={
                          <ErrorBoundary>
                            <Header />
                            <TutorialDetail />
                            <Footer />
                          </ErrorBoundary>
                        }
                      />

                      {/* Blog post detail page with nested route parameters */}
                      <Route
                        path="/pages/:pageSlug/posts/:postSlug"
                        element={
                          <ErrorBoundary>
                            <Header />
                            <PostDetail />
                            <Footer />
                          </ErrorBoundary>
                        }
                      />

                      {/* Dynamic CMS page route */}
                      <Route
                        path="/pages/:slug"
                        element={
                          <ErrorBoundary>
                            <Header />
                            <DynamicPage />
                            <Footer />
                          </ErrorBoundary>
                        }
                      />

                      {/* Login Route - standalone page without header/footer */}
                      <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />

                      {/* Protected Admin Route - requires authentication, no header/footer */}
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute>
                            <ErrorBoundary>
                              <AdminDashboard />
                            </ErrorBoundary>
                          </ProtectedRoute>
                        }
                      />

                      {/* Catch-all route for 404 handling - redirects to home */}
                      <Route
                        path="*"
                        element={
                          <ErrorBoundary>
                            <Header />
                            <Home />
                            <Footer />
                          </ErrorBoundary>
                        }
                      />
                    </Routes>
                  </div>
                </TutorialProvider>
              </ContentProvider>
            </AuthProvider>
          </Router>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  )
}

export default App
