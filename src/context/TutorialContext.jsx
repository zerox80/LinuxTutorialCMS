import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { api } from '../api/client'
import { getIconComponent as getIconComponentFromMap } from '../utils/iconMap'
const TutorialContext = createContext(null)

const FALLBACK_TUTORIALS = Object.freeze([
  {
    id: 'linux-shell-grundlagen',
    title: 'Linux Shell Grundlagen',
    description: 'Starte mit den wichtigsten Terminalbefehlen, Navigationskonzepten und grundlegenden Workflows.',
    icon: 'Terminal',
    color: 'from-primary-500 to-accent-cyan',
    topics: ['Shell', 'Bash', 'Navigation'],
    target: { type: 'route', value: '/grundlagen' },
    buttonLabel: 'Zum Grundlagenkurs',
  },
  {
    id: 'linux-dateiverwaltung',
    title: 'Dateiverwaltung & Berechtigungen',
    description: 'Verstehe Dateisysteme, Berechtigungen und sichere Arbeitsweisen für den Linux-Alltag.',
    icon: 'FolderTree',
    color: 'from-accent-emerald to-accent-cyan',
    topics: ['Dateisystem', 'Rechte', 'Sicherheit'],
    target: { type: 'route', value: '/grundlagen' },
    buttonLabel: 'Mehr über Rechte lernen',
  },
  {
    id: 'linux-netzwerkpraxis',
    title: 'Netzwerk & Praxis',
    description: 'Lerne die wichtigsten Netzwerk-Tools kennen und übe praxisnahe Szenarien mit SSH & Co.',
    icon: 'Network',
    color: 'from-accent-violet to-primary-600',
    topics: ['Netzwerk', 'SSH', 'Praxis'],
    target: { type: 'route', value: '/grundlagen' },
    buttonLabel: 'Praxisbeispiele ansehen',
  },
])

const cloneFallbackTutorials = () =>
  FALLBACK_TUTORIALS.map((tutorial) => ({
    ...tutorial,
    topics: Array.isArray(tutorial.topics) ? [...tutorial.topics] : [],
  }))
export const TutorialProvider = ({ children }) => {
  const [tutorials, setTutorials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadTutorials = useCallback(
    async ({ signal } = {}) => {
      setLoading(true)
      setError(null)
      const execute = async (attempt = 1) => {
        try {
          const data = await api.getTutorials({ signal })
          if (!signal?.aborted) {
            const list = Array.isArray(data) ? data : []
            if (list.length > 0) {
              setTutorials(list)
              setError(null)
            } else {
              setTutorials(cloneFallbackTutorials())
              setError(null)
            }
          }
        } catch (err) {
          if (signal?.aborted) {
            return
          }
          if (attempt < 3 && (!err.status || err.status >= 500)) {
            const delay = 300 * attempt
            await new Promise((resolve, reject) => {
              let timeoutId
              const cleanup = () => {
                if (timeoutId !== undefined) {
                  clearTimeout(timeoutId)
                }
                if (signal) {
                  signal.removeEventListener('abort', abortHandler)
                }
              }
              const abortHandler = () => {
                cleanup()
                reject(new Error('Aborted'))
              }
              timeoutId = setTimeout(() => {
                cleanup()
                resolve()
              }, delay)
              if (signal) {
                signal.addEventListener('abort', abortHandler)
              }
            }).catch(() => {
              return
            })
            if (!signal?.aborted) {
              return execute(attempt + 1)
            }
            return
          }
          console.error('Failed to load tutorials:', err)
          if (!signal?.aborted) {
            const fallbackError = new Error(
              'Standard-Linux-Tutorials werden angezeigt, da die echten Inhalte aktuell nicht geladen werden konnten.'
            )
            fallbackError.code = 'fallback'
            setTutorials(cloneFallbackTutorials())
            setError(fallbackError)
          }
        }
      }
      try {
        await execute()
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [],
  )
  useEffect(() => {
    const controller = new AbortController()
    loadTutorials({ signal: controller.signal })
    return () => {
      controller.abort()
    }
  }, [loadTutorials])
  const addTutorial = async (tutorial) => {
    const sanitizedTopics = Array.isArray(tutorial.topics)
      ? tutorial.topics.filter((topic) => typeof topic === 'string' && topic.trim() !== '')
      : []
    if (sanitizedTopics.length === 0) {
      const error = new Error('Mindestens ein Thema muss angegeben werden.')
      error.code = 'validation'
      throw error
    }
    const payload = {
      ...tutorial,
      topics: sanitizedTopics,
    }
    try {
      const newTutorial = await api.createTutorial(payload)
      setTutorials((prev) => {
        const newList = [...prev, newTutorial]
        newList.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        return newList
      })
      return newTutorial
    } catch (error) {
      console.error('Failed to create tutorial:', error)
      throw error
    }
  }
  const updateTutorial = async (id, updatedTutorial) => {
    const sanitizedTopics = Array.isArray(updatedTutorial.topics)
      ? updatedTutorial.topics.filter((topic) => typeof topic === 'string' && topic.trim() !== '')
      : undefined
    if (Array.isArray(updatedTutorial.topics) && (!sanitizedTopics || sanitizedTopics.length === 0)) {
      const error = new Error('Mindestens ein Thema muss angegeben werden.')
      error.code = 'validation'
      throw error
    }
    const payload = {
      ...updatedTutorial,
      ...(sanitizedTopics ? { topics: sanitizedTopics } : {}),
    }
    try {
      const updated = await api.updateTutorial(id, payload)
      setTutorials((prev) => prev.map((t) => (t.id === id ? updated : t)))
      return updated
    } catch (error) {
      console.error('Failed to update tutorial:', error)
      throw error
    }
  }
  const deleteTutorial = async (id) => {
    try {
      await api.deleteTutorial(id)
      setTutorials((prev) => prev.filter((t) => t.id !== id))
    } catch (error) {
      console.error('Failed to delete tutorial:', error)
      throw error
    }
  }
  const getTutorial = (id) => {
    return tutorials.find((t) => t.id === id)
  }
  const getIconComponent = (iconName) => getIconComponentFromMap(iconName)
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
        error,
      }}
    >
      {children}
    </TutorialContext.Provider>
  )
}
TutorialProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
export const useTutorials = () => {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorials must be used within TutorialProvider')
  }
  return context
}
