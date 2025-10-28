import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Terminal, Lock, User, AlertCircle } from 'lucide-react'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [cooldownUntil, setCooldownUntil] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Check cooldown
    if (cooldownUntil && Date.now() < cooldownUntil) {
      const remainingSeconds = Math.ceil((cooldownUntil - Date.now()) / 1000)
      setError(`Zu viele Anmeldeversuche. Bitte warte ${remainingSeconds} Sekunden.`)
      return
    }
    
    if (isSubmitting) {
      return
    }
    
    setError('')
    setIsSubmitting(true)

    try {
      const result = await login(username, password)
      if (result.success) {
        setLoginAttempts(0)
        setCooldownUntil(null)
        navigate('/admin')
      } else {
        const newAttempts = loginAttempts + 1
        setLoginAttempts(newAttempts)
        setError(result.error)
        
        // Progressive cooldown after 3 failed attempts
        if (newAttempts >= 5) {
          const cooldown = Date.now() + 60000 // 60 seconds
          setCooldownUntil(cooldown)
          setError('Zu viele fehlgeschlagene Versuche. Bitte warte 60 Sekunden.')
        } else if (newAttempts >= 3) {
          const cooldown = Date.now() + 10000 // 10 seconds
          setCooldownUntil(cooldown)
          setError('Zu viele fehlgeschlagene Versuche. Bitte warte 10 Sekunden.')
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
            <Terminal className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Linux Tutorial</h1>
          <p className="text-primary-100">Admin Login</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Anmelden</h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Benutzername
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passwort
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || (cooldownUntil && Date.now() < cooldownUntil)}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-lg font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Anmelden...' : 'Anmelden'}
            </button>
          </form>

        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-white hover:text-primary-100 transition-colors duration-200"
          >
            ← Zurück zur Startseite
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
