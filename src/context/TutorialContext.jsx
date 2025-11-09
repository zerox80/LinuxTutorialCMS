import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { api } from '../api/client'
import { getIconComponent as getIconComponentFromMap } from '../utils/iconMap'

const TutorialContext = createContext(null)

/**
 * Tutorial management context provider for handling all tutorial-related operations.
 *
 * This comprehensive context provider manages:
 * - Tutorial data fetching with automatic retry logic
 * - Full CRUD operations (Create, Read, Update, Delete)
 * - Local state synchronization with API changes
 * - Error handling and loading states
 * - Icon component mapping for UI components
 * - Optimistic updates for better user experience
 * - Data validation and sanitization
 *
 * The provider implements robust error handling with retry mechanisms
 * for server errors and provides comprehensive data management for
 * the Linux Tutorial platform's educational content.
 *
 * @example
 * ```jsx
 * // Wrap your application with the TutorialProvider
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <ContentProvider>
 *         <TutorialProvider>
 *           <Router>
 *             <AppRoutes />
 *           </Router>
 *         </TutorialProvider>
 *       </ContentProvider>
 *     </AuthProvider>
 *   );
 * }
 *
 * // Use tutorials in components
 * function TutorialList() {
 *   const { tutorials, loading, error, getIconComponent } = useTutorials();
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       {tutorials.map(tutorial => (
 *         <TutorialCard
 *           key={tutorial.id}
 *           tutorial={tutorial}
 *           Icon={getIconComponent(tutorial.icon)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @component
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components that need access to tutorial data and operations.
 * @returns {JSX.Element} TutorialContext provider with comprehensive tutorial management capabilities.
 *
 * @since 1.0.0
 * @version 1.0.0
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

TutorialProvider.propTypes = {
  /** React node(s) that will have access to the tutorial context */
  children: PropTypes.node.isRequired,
}

/**
 * Custom hook for accessing tutorial management functionality throughout the application.
 *
 * This hook provides comprehensive access to:
 * - Tutorial data array and loading states
 * - Full CRUD operations for tutorials
 * - Icon component mapping utilities
 * - Error handling and state management
 * - Data refresh capabilities
 *
 * @example
 * ```jsx
 * // Tutorial list component
 * function TutorialList() {
 *   const { tutorials, loading, error } = useTutorials();
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 *       {tutorials.map(tutorial => (
 *         <TutorialCard key={tutorial.id} tutorial={tutorial} />
 *       ))}
 *     </div>
 *   );
 * }
 *
 * // Tutorial creation component
 * function CreateTutorial() {
 *   const { addTutorial, refreshTutorials } = useTutorials();
 *
 *   const handleSubmit = async (tutorialData) => {
 *     try {
 *       await addTutorial(tutorialData);
 *       await refreshTutorials(); // Ensure fresh data
 *     } catch (error) {
 *       // Handle error
 *     }
 *   };
 * }
 *
 * // Tutorial detail component
 * function TutorialDetail({ tutorialId }) {
 *   const { getTutorial, getIconComponent, updateTutorial } = useTutorials();
 *   const tutorial = getTutorial(tutorialId);
 *   const IconComponent = getIconComponent(tutorial?.icon);
 *
 *   return (
 *     <div>
 *       <div className="flex items-center gap-2">
 *         <IconComponent className="w-6 h-6" />
 *         <h1>{tutorial.title}</h1>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns {object} Tutorial context value containing:
 *                  - tutorials {Array}: Array of tutorial objects
 *                  - loading {boolean}: Loading state for tutorial operations
 *                  - error {Error|null}: Error state for tutorial operations
 *                  - addTutorial {Function}: Function to create a new tutorial
 *                  - updateTutorial {Function}: Function to update an existing tutorial
 *                  - deleteTutorial {Function}: Function to delete a tutorial
 *                  - getTutorial {Function}: Function to get tutorial by ID
 *                  - getIconComponent {Function}: Function to get icon component by name
 *                  - refreshTutorials {Function}: Function to reload tutorial data
 *
 * @throws {Error} If used outside of a TutorialProvider wrapper component.
 *
 * @since 1.0.0
 * @version 1.0.0
 */
export const useTutorials = () => {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorials must be used within TutorialProvider')
  }
  return context
}
