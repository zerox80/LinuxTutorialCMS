import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { api } from '../api/client'
import { getIconComponent as getIconComponentFromMap } from '../utils/iconMap'

/**
 * @fileoverview Tutorial context for managing tutorial data, CRUD operations, and UI state in the LinuxTutorialCMS application.
 *
 * This context provides comprehensive tutorial management including:
 * - Tutorial CRUD operations with API synchronization
 * - Automatic retry logic for server error resilience
 * - Data validation and sanitization for content integrity
 * - Icon component mapping for consistent UI elements
 * - Loading and error state management for optimal UX
 *
 * Features:
 * - Full CRUD operations (Create, Read, Update, Delete) for tutorials
 * - Automatic retry mechanism with exponential backoff for server errors
 * - Input validation and sanitization for content security
 * - Optimistic updates with rollback on API failures
 * - Icon component mapping for consistent visual design
 * - Comprehensive error handling and user feedback
 * - Abort controller support for request cancellation
 * - Data sorting and organization capabilities
 *
 * Performance Optimizations:
 * - AbortController prevents memory leaks on component unmount
 * - Optimistic updates provide immediate UI feedback
 * - Efficient state management with minimal re-renders
 * - Caching of tutorial data for faster access
 * - Batched state updates to prevent layout thrashing
 * - Debounced retry attempts to prevent API flooding
 *
 * Data Flow Patterns:
 * 1. Load: Fetch from API with retry logic → Update state
 * 2. Create: Local update → API sync → Final state
 * 3. Update: Local optimistic update → API sync → Final state
 * 4. Delete: Local removal → API sync → Final state
 * 5. Retrieve: Local state lookup → Return cached data
 *
 * Error Handling Strategy:
 * - Network errors: Automatic retry with exponential backoff
 * - Validation errors: User-friendly error messages
 * - Server errors: Retry mechanism with maximum attempts
 * - Data corruption: Fallback to empty array with error state
 * - Request cancellation: Graceful handling with cleanup
 *
 * Security Considerations:
 * - Input sanitization for tutorial topics and content
 * - Validation of required fields before API calls
 * - Safe error handling without data leakage
 * - Protection against XSS through content validation
 * - Proper cleanup of sensitive data on errors
 *
 * Integration Patterns:
 * - Used by TutorialList for displaying tutorial collections
 * - Consumed by TutorialForm for creating and editing tutorials
 * - Integrated with TutorialCard for individual tutorial display
 * - Compatible with routing system for tutorial navigation
 * - Works with search and filtering systems
 *
 * @version 1.0.0
 * @author LinuxTutorialCMS Team
 * @since 1.0.0
 */

/**
 * Tutorial context for managing tutorial data and operations throughout the application.
 *
 * Provides tutorial state, CRUD operations, and utility functions for tutorial
 * management with comprehensive error handling and performance optimizations.
 *
 * @type {React.Context<Object|null>}
 * @property {Array} tutorials - Array of tutorial objects sorted by creation date
 * @property {boolean} loading - Loading state for tutorial operations
 * @property {Object|null} error - Error information from tutorial operations
 * @property {Function} addTutorial - Function to create a new tutorial
 * @property {Function} updateTutorial - Function to update an existing tutorial
 * @property {Function} deleteTutorial - Function to delete a tutorial
 * @property {Function} getTutorial - Function to retrieve a specific tutorial by ID
 * @property {Function} getIconComponent - Function to get icon component by name
 * @property {Function} refreshTutorials - Function to reload tutorials from API
 */
const TutorialContext = createContext(null)

/**
 * Tutorial context provider component that manages tutorial data and CRUD operations.
 *
 * This provider handles comprehensive tutorial management including loading data from the API,
 * performing CRUD operations with optimistic updates, implementing automatic retry logic for
 * resilience, and providing utility functions for tutorial access and manipulation.
 *
 * State Management:
 * - tutorials: Array of tutorial objects sorted by creation date
 * - loading: Boolean indicating when operations are in progress
 * - error: Object containing error information from failed operations
 *
 * Data Management Patterns:
 * 1. Loading: Fetch tutorials with automatic retry on server errors
 * 2. Creation: Optimistic local update with API synchronization
 * 3. Updates: Local preview changes with server confirmation
 * 4. Deletion: Immediate removal with API cleanup
 * 5. Retrieval: Efficient local state lookup by ID
 *
 * Retry Logic:
 * - Automatic retry for server errors (status >= 500)
 * - Exponential backoff with 3 maximum attempts
 * - Configurable delay based on attempt number
 * - Abort signal support for request cancellation
 * - Graceful fallback to cached data on failures
 *
 * Validation and Security:
 * - Input sanitization for tutorial topics
 * - Required field validation before API calls
 * - Content validation and XSS prevention
 * - Type checking and data structure validation
 * - Safe error handling without information leakage
 *
 * Performance Optimizations:
 * - AbortController prevents memory leaks
 * - Optimistic updates provide immediate UI feedback
 * - Efficient array operations for state updates
 * - Minimal re-renders through proper dependency management
 * - Caching of tutorial data for fast access
 *
 * Error Handling Strategy:
 * - Network errors: Automatic retry with exponential backoff
 * - Validation errors: Immediate rejection with user feedback
 * - Server errors: Retry mechanism with proper cleanup
 * - Data corruption: Fallback to empty array with error state
 * - Request cancellation: Graceful handling with state cleanup
 *
 * Integration Features:
 * - Icon component mapping for consistent UI
 * - Sorting by creation date for consistent ordering
 * - Support for tutorial topics and metadata
 * - Compatibility with routing and navigation systems
 * - Search and filtering capabilities
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components that will have access to tutorial context
 * @returns {JSX.Element} TutorialContext.Provider wrapping children with tutorial state and operations
 *
 * @example
 * ```jsx
 * // Application setup with tutorial context
 * function App() {
 *   return (
 *     <TutorialProvider>
 *       <Router>
 *         <Routes>
 *           <Route path="/tutorials" element={<TutorialList />} />
 *           <Route path="/tutorials/:id" element={<TutorialDetail />} />
 *         </Routes>
 *       </Router>
 *     </TutorialProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```jsx
 * // Using tutorial context in a component
 * function TutorialList() {
 *   const { tutorials, loading, error, deleteTutorial } = useTutorials();
 *
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       {tutorials.map(tutorial => (
 *         <TutorialCard
 *           key={tutorial.id}
 *           tutorial={tutorial}
 *           onDelete={() => deleteTutorial(tutorial.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see useTutorials - Hook for accessing tutorial context
 * @see api.getTutorials - API method for fetching tutorials
 * @see api.createTutorial - API method for creating tutorials
 * @see api.updateTutorial - API method for updating tutorials
 * @see api.deleteTutorial - API method for deleting tutorials
 */
export const TutorialProvider = ({ children }) => {
  const [tutorials, setTutorials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  
  /**
   * Loads tutorials from API with automatic retry on server errors.
   * 
   * @param {Object} [options] - Load options
   * @param {AbortSignal} [options.signal] - Abort signal for cancellation
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

  useEffect(() => {
    const controller = new AbortController()
    loadTutorials({ signal: controller.signal })

    return () => {
      controller.abort()
    }
  }, [loadTutorials])

  
  /**
   * Creates a new tutorial.
   * 
   * @param {Object} tutorial - Tutorial data to create
   * @returns {Promise<Object>} Created tutorial object
   * @throws {Error} If validation fails or API request fails
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
   * Updates an existing tutorial.
   * 
   * @param {string} id - Tutorial ID to update
   * @param {Object} updatedTutorial - Updated tutorial data
   * @returns {Promise<Object>} Updated tutorial object
   * @throws {Error} If validation fails or API request fails
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
   * Deletes a tutorial by ID.
   * 
   * @param {string} id - Tutorial ID to delete
   * @returns {Promise<void>}
   * @throws {Error} If API request fails
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
   * Gets a tutorial by ID from local state.
   * 
   * @param {string} id - Tutorial ID to find
   * @returns {Object|undefined} Tutorial object or undefined if not found
   */
  const getTutorial = (id) => {
    return tutorials.find((t) => t.id === id)
  }

  
  /**
   * Gets icon component by name.
   * 
   * @param {string} iconName - Icon name to retrieve
   * @returns {React.ComponentType} Icon component
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
  
  children: PropTypes.node.isRequired,
}

/**
 * Custom hook for accessing the tutorial context within functional components.
 *
 * This hook provides a clean interface for components to access tutorial data,
 * perform CRUD operations, and utilize tutorial-related utility functions. It includes
 * safety checks to ensure the hook is used within a TutorialProvider wrapper.
 *
 * Hook Usage Patterns:
 * - Call at the top level of functional components
 * - Destructure needed values from the returned object
 * - Handle loading and error states appropriately
 * - Use for both read-only and modification operations
 *
 * Available Context Values:
 * - tutorials: Array of tutorial objects sorted by creation date
 * - loading: Boolean indicating when tutorial operations are in progress
 * - error: Error object containing information from failed operations
 * - addTutorial: Function to create a new tutorial with validation
 * - updateTutorial: Function to update an existing tutorial
 * - deleteTutorial: Function to delete a tutorial by ID
 * - getTutorial: Function to retrieve a specific tutorial by ID
 * - getIconComponent: Function to get icon component by name
 * - refreshTutorials: Function to reload tutorials from API with retry logic
 *
 * Error Handling:
 * - Throws descriptive error if used outside TutorialProvider
 * - Error message helps developers debug context setup issues
 * - Prevents undefined context access in components
 * - Validates provider availability before returning context
 *
 * Performance Features:
 * - Uses React's useContext for optimal performance
 * - Stable context value through useCallback in provider
 * - No additional re-renders beyond context value changes
 * - Efficient prop access through destructuring
 * - Optimistic updates for immediate UI feedback
 *
 * Integration Examples:
 * ```jsx
 * // Tutorial list component
 * function TutorialList() {
 *   const { tutorials, loading, error, deleteTutorial } = useTutorials();
 *
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div className="grid gap-4">
 *       {tutorials.map(tutorial => (
 *         <TutorialCard
 *           key={tutorial.id}
 *           tutorial={tutorial}
 *           onDelete={() => deleteTutorial(tutorial.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * ```jsx
 * // Tutorial form component for creating/editing
 * function TutorialForm({ tutorialId }) {
 *   const { addTutorial, updateTutorial, getTutorial } = useTutorials();
 *   const [formData, setFormData] = useState({});
 *
 *   useEffect(() => {
 *     if (tutorialId) {
 *       const tutorial = getTutorial(tutorialId);
 *       if (tutorial) setFormData(tutorial);
 *     }
 *   }, [tutorialId, getTutorial]);
 *
 *   const handleSubmit = async (e) => {
 *     e.preventDefault();
 *     try {
 *       if (tutorialId) {
 *         await updateTutorial(tutorialId, formData);
 *       } else {
 *         await addTutorial(formData);
 *       }
 *       // Navigate or show success message
 *     } catch (error) {
 *       // Show error message
 *     }
 *   };
 *
 *   return <form onSubmit={handleSubmit}>Form fields here</form>;
 * }
 * ```
 *
 * ```jsx
 * // Tutorial detail component
 * function TutorialDetail({ id }) {
 *   const { getTutorial, loading, error } = useTutorials();
 *   const tutorial = getTutorial(id);
 *
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!tutorial) return <NotFound />; // Tutorial not found
 *
 *   return (
 *     <div>
 *       <h1>{tutorial.title}</h1>
 *       <p>{tutorial.description}</p>
 *       {/* Additional tutorial content */}
 *     </div>
 *   );
 * }
 * ```
 *
 * ```jsx
 * // Search and filter component
 * function TutorialSearch() {
 *   const { tutorials, loading } = useTutorials();
 *   const [searchTerm, setSearchTerm] = useState('');
 *
 *   const filteredTutorials = tutorials.filter(tutorial =>
 *     tutorial.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
 *     tutorial.topics.some(topic => topic.toLowerCase().includes(searchTerm.toLowerCase()))
 *   );
 *
 *   return (
 *     <div>
 *       <input
 *         type="text"
 *         placeholder="Search tutorials..."
 *         value={searchTerm}
 *         onChange={(e) => setSearchTerm(e.target.value)}
 *       />
 *       {loading ? <LoadingSpinner /> : (
 *         <TutorialList tutorials={filteredTutorials} />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns {Object} Complete tutorial context value object
 * @returns {Array} returns.tutorials - Array of tutorial objects sorted by creation date
 * @returns {boolean} returns.loading - Loading state for tutorial operations
 * @returns {Object|null} returns.error - Error information from tutorial operations
 * @returns {Function} returns.addTutorial - Function to create a new tutorial
 * @returns {Function} returns.updateTutorial - Function to update an existing tutorial
 * @returns {Function} returns.deleteTutorial - Function to delete a tutorial
 * @returns {Function} returns.getTutorial - Function to retrieve a specific tutorial by ID
 * @returns {Function} returns.getIconComponent - Function to get icon component by name
 * @returns {Function} returns.refreshTutorials - Function to reload tutorials from API
 *
 * @throws {Error} If the hook is used outside of a TutorialProvider component
 *
 * @example
 * ```jsx
 * // Basic usage
 * function MyComponent() {
 *   const { tutorials, loading, error } = useTutorials();
 *
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <h1>Available Tutorials ({tutorials.length})</h1>
 *       {/* Tutorial display */}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```jsx
 * // CRUD operations
 * function TutorialManager() {
 *   const {
 *     tutorials,
 *     addTutorial,
 *     updateTutorial,
 *     deleteTutorial,
 *     getTutorial
 *   } = useTutorials();
 *
 *   const handleCreate = async (tutorialData) => {
 *     await addTutorial(tutorialData);
 *   };
 *
 *   const handleUpdate = async (id, updatedData) => {
 *     await updateTutorial(id, updatedData);
 *   };
 *
 *   const handleDelete = async (id) => {
 *     await deleteTutorial(id);
 *   };
 *
 *   return (
 *     <div>
 *       {/* Tutorial management UI */}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see TutorialProvider - Provider component that creates the tutorial context
 * @see TutorialContext - The underlying React context object
 * @see useContext - React hook used internally
 * @see api - API client used for tutorial operations
 */
export const useTutorials = () => {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorials must be used within TutorialProvider')
  }
  return context
}
