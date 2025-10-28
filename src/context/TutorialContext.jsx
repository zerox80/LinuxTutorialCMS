import { createContext, useContext, useState, useEffect } from 'react'
import { Terminal, FolderTree, FileText, Settings, Shield, Network, Database, Server } from 'lucide-react'
import { api } from '../api/client'

const TutorialContext = createContext(null)

// Icon mapping
const iconMap = {
  Terminal,
  FolderTree,
  FileText,
  Settings,
  Shield,
  Network,
  Database,
  Server,
}

export const TutorialProvider = ({ children }) => {
  const [tutorials, setTutorials] = useState([])
  const [loading, setLoading] = useState(true)

  // Load tutorials from API
  useEffect(() => {
    loadTutorials()
  }, [])

  const loadTutorials = async () => {
    try {
      const data = await api.getTutorials()
      setTutorials(data)
    } catch (error) {
      console.error('Failed to load tutorials:', error)
    } finally {
      setLoading(false)
    }
  }

  const addTutorial = async (tutorial) => {
    try {
      const newTutorial = await api.createTutorial(tutorial)
      setTutorials([...tutorials, newTutorial])
      return newTutorial
    } catch (error) {
      console.error('Failed to create tutorial:', error)
      throw error
    }
  }

  const updateTutorial = async (id, updatedTutorial) => {
    try {
      const updated = await api.updateTutorial(id, updatedTutorial)
      setTutorials(tutorials.map((t) => (t.id === id ? updated : t)))
      return updated
    } catch (error) {
      console.error('Failed to update tutorial:', error)
      throw error
    }
  }

  const deleteTutorial = async (id) => {
    try {
      await api.deleteTutorial(id)
      setTutorials(tutorials.filter((t) => t.id !== id))
    } catch (error) {
      console.error('Failed to delete tutorial:', error)
      throw error
    }
  }

  const getTutorial = (id) => {
    return tutorials.find((t) => t.id === id)
  }

  const getIconComponent = (iconName) => {
    return iconMap[iconName] || Terminal
  }

  return (
    <TutorialContext.Provider
      value={{
        tutorials,
        loading,
        addTutorial,
        updateTutorial,
        deleteTutorial,
        getTutorial,
        getIconComponent,
        refreshTutorials: loadTutorials,
      }}
    >
      {children}
    </TutorialContext.Provider>
  )
}

export const useTutorials = () => {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorials must be used within TutorialProvider')
  }
  return context
}
