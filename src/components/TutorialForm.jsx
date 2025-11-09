import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTutorials } from '../context/TutorialContext'
import { X, Save, Plus, Trash2, AlertCircle } from 'lucide-react'
const TutorialForm = ({ tutorial, onClose }) => {
  const { addTutorial, updateTutorial } = useTutorials()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    icon: 'Terminal',
    color: 'from-blue-500 to-cyan-500',
    topics: [''],
    content: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  useEffect(() => {
    if (tutorial) {
      const validTopics = Array.isArray(tutorial.topics) 
        ? tutorial.topics.filter(t => t && t.trim() !== '') 
        : []
      setFormData({
        title: tutorial.title || '',
        description: tutorial.description || '',
        icon: tutorial.icon || 'Terminal',
        color: tutorial.color || 'from-blue-500 to-cyan-500',
        topics: validTopics.length > 0 ? validTopics : [''],
        content: tutorial.content || '',
      })
    } else {
      setFormData({
        title: '',
        description: '',
        icon: 'Terminal',
        color: 'from-blue-500 to-cyan-500',
        topics: [''],
        content: '',
      })
    }
  }, [tutorial])
  const iconOptions = [
    'Terminal',
    'FolderTree',
    'FileText',
    'Settings',
    'Shield',
    'Network',
    'Database',
    'Server',
  ]
  const colorOptions = [
    { value: 'from-blue-500 to-cyan-500', label: 'Blau' },
    { value: 'from-green-500 to-emerald-500', label: 'Grün' },
    { value: 'from-purple-500 to-pink-500', label: 'Lila' },
    { value: 'from-orange-500 to-red-500', label: 'Orange' },
    { value: 'from-indigo-500 to-blue-500', label: 'Indigo' },
    { value: 'from-teal-500 to-green-500', label: 'Türkis' },
    { value: 'from-yellow-500 to-orange-500', label: 'Gelb' },
    { value: 'from-red-500 to-pink-500', label: 'Rot' },
  ]
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) {
      return
    }
    const cleanedData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      icon: formData.icon,
      color: formData.color,
      topics: formData.topics
        .map((t) => (t || '').trim())
        .filter((t) => t !== ''),
      content: formData.content,
    }
    if (!cleanedData.title) {
      setFormError('Der Titel darf nicht leer sein.')
      return
    }
    if (!cleanedData.description) {
      setFormError('Die Beschreibung darf nicht leer sein.')
      return
    }
    if (cleanedData.topics.length === 0) {
      setFormError('Füge mindestens ein Thema hinzu.')
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      if (tutorial) {
        await updateTutorial(tutorial.id, cleanedData)
      } else {
        await addTutorial(cleanedData)
      }
      onClose()
    } catch (error) {
      console.error('Tutorial save error:', error)
      let errorMessage = 'Fehler beim Speichern: '
      if (error.status === 502) {
        errorMessage += 'Der Server antwortet nicht. Bitte versuche es in ein paar Sekunden erneut.'
      } else if (error.status === 504 || error.status === 408) {
        errorMessage += 'Die Anfrage dauert zu lange. Versuche, weniger Inhalt auf einmal zu speichern.'
      } else if (error.status === 413) {
        errorMessage += 'Der Inhalt ist zu groß. Bitte reduziere die Größe des Tutorials.'
      } else if (error.status === 409) {
        errorMessage += 'Das Tutorial wurde von jemand anderem geändert. Bitte lade die Seite neu.'
      } else if (error.status >= 500) {
        errorMessage += 'Serverfehler. Bitte kontaktiere den Administrator.'
      } else {
        errorMessage += error.message || 'Unbekannter Fehler'
      }
      setFormError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }
  const handleTopicChange = (index, value) => {
    const newTopics = [...formData.topics]
    newTopics[index] = value
    setFormData({ ...formData, topics: newTopics })
  }
  const addTopic = () => {
    setFormData({ ...formData, topics: [...formData.topics, ''] })
  }
  const removeTopic = (index) => {
    const newTopics = formData.topics.filter((_, i) => i !== index)
    setFormData({ ...formData, topics: newTopics })
  }
  return (
    <div className="p-8 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
      {}
      <div className="flex justify-between items-center mb-6">
        <h2 id="modal-title" className="text-2xl font-bold text-gray-800 dark:text-slate-100">
          {tutorial ? 'Tutorial bearbeiten' : 'Neues Tutorial erstellen'}
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors duration-200"
        >
          <X className="w-6 h-6 text-gray-600 dark:text-slate-300" />
        </button>
      </div>
      {}
      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300" role="alert">
            <AlertCircle className="w-5 h-5 mt-0.5" aria-hidden="true" />
            <span className="text-sm">{formError}</span>
          </div>
        )}
        {}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Titel *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="z.B. Grundlegende Befehle"
            maxLength={200}
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{formData.title.length}/200 Zeichen</p>
        </div>
        {}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Beschreibung *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows="3"
            placeholder="Kurze Beschreibung des Tutorials"
            maxLength={1000}
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{formData.description.length}/1000 Zeichen</p>
        </div>
        {}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Icon
            </label>
            <select
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {iconOptions.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Farbe
            </label>
            <select
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {colorOptions.map((color) => (
                <option key={color.value} value={color.value}>
                  {color.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Themen
            </label>
            <button
              type="button"
              onClick={addTopic}
              className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-700"
            >
              <Plus className="w-4 h-4" />
              <span>Thema hinzufügen</span>
            </button>
          </div>
          <div className="space-y-2">
            {formData.topics.map((topic, index) => (
              <div key={index} className="flex space-x-2">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => handleTopicChange(index, e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={`Thema ${index + 1}`}
                  maxLength={100}
                />
                {formData.topics.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTopic(index)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        {}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Inhalt (Markdown unterstützt)
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
            rows="10"
            placeholder="Hier kannst du den vollständigen Tutorial-Inhalt eingeben..."
            maxLength={100000}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{formData.content.length}/100000 Zeichen</p>
        </div>
        {}
        <div className="flex space-x-4 pt-4 border-t border-gray-200 dark:border-slate-800">
          <button
            type="submit"
            className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-60"
            disabled={submitting}
          >
            <Save className="w-5 h-5" />
            <span>{submitting ? 'Speichere…' : tutorial ? 'Änderungen speichern' : 'Tutorial erstellen'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}
TutorialForm.propTypes = {
  tutorial: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    icon: PropTypes.string,
    color: PropTypes.string,
    topics: PropTypes.arrayOf(PropTypes.string),
    content: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
}
export default TutorialForm
