import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TutorialProvider } from './context/TutorialContext'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  const [activeSection, setActiveSection] = useState('home')

  return (
    <Router>
      <AuthProvider>
        <TutorialProvider>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <Routes>
              {/* Public Routes with Header & Footer */}
              <Route
                path="/"
                element={
                  <>
                    <Header activeSection={activeSection} setActiveSection={setActiveSection} />
                    <Home />
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
            </Routes>
          </div>
        </TutorialProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
