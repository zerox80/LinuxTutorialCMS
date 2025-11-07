import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from './context/AuthContext'
import { ContentProvider } from './context/ContentContext'
import { TutorialProvider } from './context/TutorialContext'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Grundlagen from './pages/Grundlagen'
import Login from './pages/Login'
import TutorialDetail from './pages/TutorialDetail'
import DynamicPage from './pages/DynamicPage'
import PostDetail from './pages/PostDetail'
import AdminDashboard from './pages/AdminDashboard'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <ThemeProvider>
          <Router>
            <AuthProvider>
              <ContentProvider>
                <TutorialProvider>
                <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors">
                <Routes>
                {/* Public Routes with Header & Footer */}
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
                
                {/* Login Route (no Header/Footer) */}
                <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
                
                {/* Protected Admin Route (no Header/Footer from main layout) */}
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
