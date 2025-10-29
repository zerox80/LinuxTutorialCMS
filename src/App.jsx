import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ContentProvider } from './context/ContentContext'
import { TutorialProvider } from './context/TutorialContext'
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
      <Router>
        <AuthProvider>
          <ContentProvider>
            <TutorialProvider>
              <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <Routes>
                {/* Public Routes with Header & Footer */}
                <Route
                  path="/"
                  element={
                    <>
                      <Header />
                      <Home />
                      <Footer />
                    </>
                  }
                />

                <Route
                  path="/grundlagen"
                  element={
                    <>
                      <Header />
                      <Grundlagen />
                      <Footer />
                    </>
                  }
                />

                <Route
                  path="/tutorials/:id"
                  element={
                    <>
                      <Header />
                      <TutorialDetail />
                      <Footer />
                    </>
                  }
                />

                <Route
                  path="/pages/:pageSlug/posts/:postSlug"
                  element={
                    <>
                      <Header />
                      <PostDetail />
                      <Footer />
                    </>
                  }
                />

                <Route
                  path="/pages/:slug"
                  element={
                    <>
                      <Header />
                      <DynamicPage />
                      <Footer />
                    </>
                  }
                />
                
                {/* Login Route (no Header/Footer) */}
                <Route path="/login" element={<Login />} />
                
                {/* Protected Admin Route (no Header/Footer from main layout) */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="*"
                  element={
                    <>
                      <Header />
                      <Home />
                      <Footer />
                    </>
                  }
                />
                </Routes>
              </div>
            </TutorialProvider>
          </ContentProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
