
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom' // React Router for client-side routing
import { HelmetProvider } from 'react-helmet-async' // For managing document head tags and SEO

import { AuthProvider } from './context/AuthContext' // Authentication state management
import { ContentProvider } from './context/ContentContext' // Content data management
import { TutorialProvider } from './context/TutorialContext' // Tutorial-specific state management
import { ThemeProvider } from './context/ThemeContext' // Theme and UI appearance management

import ErrorBoundary from './components/ErrorBoundary' // Error handling wrapper component
import Header from './components/Header' // Site navigation header
import Footer from './components/Footer' // Site footer
import ProtectedRoute from './components/ProtectedRoute' // Route protection for authenticated users
import GlobalSiteMeta from './components/GlobalSiteMeta'

import Home from './pages/Home' // Landing/home page
import Grundlagen from './pages/Grundlagen' // Linux basics page
import Login from './pages/Login' // User authentication page
import TutorialDetail from './pages/TutorialDetail' // Individual tutorial view
import DynamicPage from './pages/DynamicPage' // CMS-driven dynamic pages
import PostDetail from './pages/PostDetail' // Individual blog post view
import AdminDashboard from './pages/AdminDashboard' // Admin control panel

function App() {
  return (

    <ErrorBoundary>
      {}
      <HelmetProvider>
        {}
        <ThemeProvider>
          {}
          <Router>
            {}
            <AuthProvider>
              {}
              <ContentProvider>
                {}
                <TutorialProvider>
                  {}
                  <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors">
                    <GlobalSiteMeta />
                    <Routes>
                      {}
                      {}
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

                      {}
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

                      {}
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

                      {}
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

                      {}
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

                      {}
                      <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />

                      {}
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

                      {}
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
