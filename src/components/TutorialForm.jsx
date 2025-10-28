import { useState, useEffect } from 'react'
import { useTutorials } from '../context/TutorialContext'
import { X, Save, Plus, Trash2 } from 'lucide-react'

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

  useEffect(() => {
    if (tutorial) {
      setFormData({
        title: tutorial.title || '',
        description: tutorial.description || '',
        icon: tutorial.icon || 'Terminal',
        color: tutorial.color || 'from-blue-500 to-cyan-500',
        topics: Array.isArray(tutorial.topics) && tutorial.topics.length > 0 ? [...tutorial.topics] : [''],
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
    
    // Filter out empty topics
    const cleanedData = {
      title: formData.title,
      description: formData.description,
      icon: formData.icon,
      color: formData.color,
      topics: formData.topics.filter((t) => t.trim() !== ''),
      content: formData.content,
    }

    try {
      if (tutorial) {
        await updateTutorial(tutorial.id, cleanedData)
      } else {
        await addTutorial(cleanedData)
      }
      onClose()
    } catch (error) {
      alert('Fehler beim Speichern: ' + error.message)
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
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {tutorial ? 'Tutorial bearbeiten' : 'Neues Tutorial erstellen'}
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <X className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Titel *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="z.B. Grundlegende Befehle"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Beschreibung *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows="3"
            placeholder="Kurze Beschreibung des Tutorials"
            required
          />
        </div>

        {/* Icon & Color */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Icon
            </label>
            <select
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {iconOptions.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Farbe
            </label>
            <select
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {colorOptions.map((color) => (
                <option key={color.value} value={color.value}>
                  {color.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Topics */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={`Thema ${index + 1}`}
                />
                {formData.topics.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTopic(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Inhalt (Markdown unterstützt)
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
            rows="10"
            placeholder="Hier kannst du den vollständigen Tutorial-Inhalt eingeben..."
          />
        </div>

        {/* Actions */}
        <div className="flex space-x-4 pt-4 border-t border-gray-200">
          <button
            type="submit"
            className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Save className="w-5 h-5" />
            <span>{tutorial ? 'Änderungen speichern' : 'Tutorial erstellen'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}

export default TutorialForm
