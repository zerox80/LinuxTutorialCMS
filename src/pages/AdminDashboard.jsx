import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTutorials } from '../context/TutorialContext'
import { Plus, Edit, Trash2, LogOut, Home, Terminal } from 'lucide-react'
import TutorialForm from '../components/TutorialForm'

const AdminDashboard = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingTutorial, setEditingTutorial] = useState(null)
  const { logout, user } = useAuth()
  const { tutorials, deleteTutorial } = useTutorials()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleEdit = (tutorial) => {
    setEditingTutorial(tutorial)
    setShowForm(true)
  }

  const handleDelete = (id) => {
    if (window.confirm('Möchtest du dieses Tutorial wirklich löschen?')) {
      deleteTutorial(id)
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
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Tutorial Verwaltung</h2>
            <p className="text-gray-600 mt-1">Erstelle, bearbeite und verwalte deine Tutorials</p>
          </div>
          <button
            onClick={() => {
              setEditingTutorial(null)
              setShowForm(true)
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5" />
            <span>Neues Tutorial</span>
          </button>
        </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tutorials.map((tutorial) => (
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
                    {tutorial.topics.slice(0, 3).map((topic, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full"
                      >
                        {topic}
                      </span>
                    ))}
                    {tutorial.topics.length > 3 && (
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
                  <button
                    onClick={() => handleDelete(tutorial.id)}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Löschen</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {tutorials.length === 0 && (
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
