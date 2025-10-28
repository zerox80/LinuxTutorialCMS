import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTutorials } from '../context/TutorialContext'
import { Plus, Edit, Trash2, LogOut, Home, Terminal, RefreshCw, AlertCircle } from 'lucide-react'
import TutorialForm from '../components/TutorialForm'

const AdminDashboard = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingTutorial, setEditingTutorial] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const { logout, user } = useAuth()
  const { tutorials, deleteTutorial, loading, error, refreshTutorials } = useTutorials()
  const navigate = useNavigate()
  const sortedTutorials = useMemo(
    () => [...tutorials].sort((a, b) => a.title.localeCompare(b.title, 'de')),
    [tutorials],
  )

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleEdit = (tutorial) => {
    setEditingTutorial(tutorial)
    setShowForm(true)
  }

  const handleDeleteRequest = (id) => {
    setDeleteError(null)
    setConfirmingId(id)
  }

  const handleDeleteCancel = () => {
    setConfirmingId(null)
    setDeletingId(null)
    setDeleteError(null)
  }

  const handleDeleteConfirm = async (id) => {
    setDeleteError(null)
    setDeletingId(id)
    try {
      await deleteTutorial(id)
      setConfirmingId(null)
    } catch (err) {
      const message = err?.message || 'Löschen fehlgeschlagen'
      setDeleteError({ id, message })
    } finally {
      setDeletingId(null)
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingTutorial(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-primary-600 to-primary-800 p-2 rounded-lg">
                <Terminal className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">Willkommen, {user?.username}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                <Home className="w-4 h-4" />
                <span>Startseite</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span>Abmelden</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Actions */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Tutorial Verwaltung</h2>
            <p className="text-gray-600 mt-1">Erstelle, bearbeite und verwalte deine Tutorials</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => refreshTutorials()}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 disabled:opacity-60"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Aktualisiere…' : 'Aktualisieren'}</span>
            </button>
            <button
              onClick={() => {
                setEditingTutorial(null)
                setShowForm(true)
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              <span>Neues Tutorial</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 text-red-700" role="alert">
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Fehler beim Laden der Tutorials</p>
              <p className="text-sm">{error?.message || String(error)}</p>
            </div>
          </div>
        )}

        {/* Tutorial Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <TutorialForm
                tutorial={editingTutorial}
                onClose={handleCloseForm}
              />
            </div>
          </div>
        )}

        {/* Tutorials Grid */}
        {loading && tutorials.length === 0 ? (
          <div className="py-16 text-center text-gray-600">Lade Tutorials…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedTutorials.map((tutorial) => (
              <div
                key={tutorial.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
              >
                <div className={`h-2 bg-gradient-to-r ${tutorial.color}`}></div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{tutorial.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {tutorial.description}
                  </p>
                  
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {(tutorial.topics || []).slice(0, 3).map((topic, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full"
                        >
                          {topic}
                        </span>
                      ))}
                      {tutorial.topics && tutorial.topics.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{tutorial.topics.length - 3} mehr
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(tutorial)}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors duration-200"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Bearbeiten</span>
                    </button>
                    {confirmingId === tutorial.id ? (
                      <div className="flex-1 flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDeleteConfirm(tutorial.id)}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-70"
                          disabled={deletingId === tutorial.id}
                        >
                          {deletingId === tutorial.id ? 'Lösche…' : 'Löschen bestätigen'}
                        </button>
                        <button
                          onClick={handleDeleteCancel}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                          type="button"
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDeleteRequest(tutorial.id)}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors duration-200"
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Löschen</span>
                      </button>
                    )}
                  </div>
                  {deleteError?.id === tutorial.id && (
                    <p className="mt-3 text-sm text-red-600" role="alert">
                      {deleteError.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && tutorials.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Terminal className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Noch keine Tutorials vorhanden
            </h3>
            <p className="text-gray-600 mb-6">
              Erstelle dein erstes Tutorial, um loszulegen.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
              <span>Erstes Tutorial erstellen</span>
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminDashboard
