import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { getIconComponent as getIconComponentFromMap } from '../utils/iconMap'

const TutorialContext = createContext(null)

/**
 * Provides tutorial data and management functions to its children components.
 * It handles fetching, creating, updating, and deleting tutorials.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components that need access to the tutorial context.
 * @returns {JSX.Element} The TutorialContext provider.
 */
export const TutorialProvider = ({ children }) => {
  const [tutorials, setTutorials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /**
   * Loads tutorials from the API with retry logic for server errors.
   *
   * @param {object} [options] - Load options.
   * @param {AbortSignal} [options.signal] - Optional abort signal for cancellation.
   * @returns {Promise<void>}
   */
  const loadTutorials = useCallback(
    async ({ signal } = {}) => {
      setLoading(true)
      setError(null)

      const execute = async (attempt = 1) => {
        try {
          const data = await api.getTutorials({ signal })
          if (!signal?.aborted) {
            setTutorials(Array.isArray(data) ? data : [])
            setError(null)
          }
        } catch (err) {
          if (signal?.aborted) {
            return
          }

          if (attempt < 3 && (!err.status || err.status >= 500)) {
            const delay = 300 * attempt
            // Use AbortSignal.timeout with race to cancel timeout on abort
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
            setTutorials([])
            setError(err)
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

  // Load tutorials from API
  useEffect(() => {
    const controller = new AbortController()
    loadTutorials({ signal: controller.signal })

    return () => {
      controller.abort()
    }
  }, [loadTutorials])

  /**
   * Creates a new tutorial via the API.
   *
   * @param {object} tutorial - The tutorial data to create.
   * @param {string} tutorial.title - The tutorial title.
   * @param {string} tutorial.description - The tutorial description.
   * @param {Array<string>} tutorial.topics - Array of topic strings.
   * @returns {Promise<object>} The created tutorial object.
   */
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
      // Insert in correct position (sorted by created_at ASC)
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

  /**
   * Updates an existing tutorial via the API.
   *
   * @param {string} id - The tutorial ID to update.
   * @param {object} updatedTutorial - The updated tutorial data.
   * @returns {Promise<object>} The updated tutorial object.
   */
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

  /**
   * Deletes a tutorial via the API.
   *
   * @param {string} id - The tutorial ID to delete.
   * @returns {Promise<void>}
   */
  const deleteTutorial = async (id) => {
    try {
      await api.deleteTutorial(id)
      setTutorials((prev) => prev.filter((t) => t.id !== id))
    } catch (error) {
      console.error('Failed to delete tutorial:', error)
      throw error
    }
  }

  /**
   * Retrieves a tutorial from the local state by ID.
   *
   * @param {string} id - The tutorial ID to retrieve.
   * @returns {object|undefined} The tutorial object, or undefined if not found.
   */
  const getTutorial = (id) => {
    return tutorials.find((t) => t.id === id)
  }

  /**
   * Retrieves a Lucide icon component by name.
   *
   * @param {string} iconName - The name of the icon.
   * @returns {React.ComponentType} The icon component.
   */
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

/**
 * Custom hook to access the tutorial context.
 *
 * @returns {object} The tutorial context value with tutorials, loading state, errors, and CRUD helpers.
 * @throws {Error} Thrown when the hook is used outside of a `TutorialProvider`.
 */
export const useTutorials = () => {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorials must be used within TutorialProvider')
  }
  return context
}
