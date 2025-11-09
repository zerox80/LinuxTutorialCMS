// React hooks imports
import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// Context imports for global state management
import { useAuth } from '../context/AuthContext'           // Authentication and user state
import { useTutorials } from '../context/TutorialContext'   // Tutorial data and operations
import { useContent } from '../context/ContentContext'     // Site content management

// Icon imports from Lucide React library
import {
  Plus,              // Add/create icon
  Edit,              // Edit/pencil icon
  Trash2,            // Delete/trash icon
  LogOut,            // Logout icon
  Home,              // Home page icon
  Terminal,          // Terminal/command line icon
  RefreshCw,         // Refresh/rotate icon
  AlertCircle,       // Warning/alert icon
  LayoutDashboard,   // Dashboard layout icon
  Paintbrush,        // Content/styling icon
  FileText,          // Page/document icon
} from 'lucide-react'

// Component imports for admin functionality
import TutorialForm from '../components/TutorialForm'       // Tutorial creation/editing form
import SiteContentEditor from '../components/SiteContentEditor' // Static site content editor
import PageManager from '../components/PageManager'         // Dynamic page and post management

/**
 * Comprehensive admin dashboard interface for managing all aspects of the CMS.
 *
 * This component provides a full-featured administrative interface with:
 * - Tutorial management: Create, edit, delete tutorials with rich content support
 * - Content management: Edit static site content through a visual editor
 * - Page management: Manage dynamic pages and blog posts
 * - User authentication: Secure admin area with proper access controls
 * - Modal forms: Elegant forms for tutorial creation and editing
 * - Error handling: Comprehensive error states and user feedback
 * - Loading states: Proper loading indicators for all async operations
 * - Keyboard navigation: Full keyboard accessibility support (ESC, tab navigation)
 * - Responsive design: Works seamlessly on desktop and mobile devices
 *
 * The dashboard uses a tabbed interface to organize different administrative
 * functions and integrates with all major context providers for state management.
 *
 * @example
 * ```jsx
 * // Protected route wrapper for admin access
 * <Route path="/admin/*" element={
 *   <ProtectedRoute>
 *     <AdminDashboard />
 *   </ProtectedRoute>
 * } />
 * ```
 *
 * @component
 * @returns {JSX.Element} A complete admin dashboard with tabbed interface,
 *                          modal forms, error handling, and full CRUD operations
 *                          for tutorials, content, and pages management.
 *
 * @since 1.0.0
 * @version 1.0.0
 */
const AdminDashboard = () => {
  // === STATE MANAGEMENT ===

  // UI state for tabbed interface
  const [activeTab, setActiveTab] = useState('tutorials')     // Currently active tab ('tutorials', 'content', 'pages')

  // Modal state for tutorial form
  const [showForm, setShowForm] = useState(false)              // Controls tutorial form modal visibility
  const [editingTutorial, setEditingTutorial] = useState(null) // Tutorial being edited (null for create mode)

  // Delete operation state
  const [deletingId, setDeletingId] = useState(null)           // ID of tutorial currently being deleted
  const [confirmingId, setConfirmingId] = useState(null)       // ID of tutorial awaiting delete confirmation
  const [deleteError, setDeleteError] = useState(null)         // Error message for failed delete operations

  // Ref to track component mount state for async operations
  const isMountedRef = useRef(true)

  // === CONTEXT AND NAVIGATION ===

  const { logout, user } = useAuth()                           // Auth context for logout and user info
  const { tutorials, deleteTutorial, loading, error, refreshTutorials } = useTutorials() // Tutorial context
  const { loading: contentLoading } = useContent()             // Content context loading state
  const navigate = useNavigate()                              // React Router navigation function

  // === DERIVED STATE ===

  // Memoized sorted tutorials list for stable renders
  // Sorts tutorials alphabetically by title using German locale
  const sortedTutorials = useMemo(
    () => [...tutorials].sort((a, b) => a.title.localeCompare(b.title, 'de')),
    [tutorials],
  )

  /**
   * Logs out the current user and navigates to the login page.
   *
   * @returns {void}
   */
  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  /**
   * Opens the tutorial form modal in edit mode with the specified tutorial.
   *
   * @param {object} tutorial - The tutorial object to edit.
   * @returns {void}
   */
  const handleEdit = (tutorial) => {
    setEditingTutorial(tutorial)
    setShowForm(true)
  }

  /**
   * Initiates a delete confirmation for the specified tutorial ID.
   *
   * @param {string} id - The ID of the tutorial to delete.
   * @returns {void}
   */
  const handleDeleteRequest = (id) => {
    setDeleteError(null)
    setConfirmingId(id)
  }

  /**
   * Cancels the delete operation and resets all delete-related states.
   * This handles both the confirmation state and any error states.
   *
   * @returns {void}
   */
  const handleDeleteCancel = () => {
    setConfirmingId(null)     // Clear awaiting confirmation state
    setDeletingId(null)       // Clear currently deleting state
    setDeleteError(null)      // Clear any error messages
  }

  /**
   * Confirms and executes the tutorial deletion with proper error handling.
   * Includes loading states and mounted state checks to prevent memory leaks.
   *
   * @param {string} id - The ID of the tutorial to delete.
   * @returns {Promise<void>}
   */
  const handleDeleteConfirm = async (id) => {
    setDeleteError(null)      // Clear previous errors
    setDeletingId(id)         // Set loading state for this specific tutorial

    try {
      // Attempt to delete the tutorial via context
      await deleteTutorial(id)

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setConfirmingId(null)  // Clear confirmation state on success
      }
    } catch (err) {
      // Handle deletion errors gracefully
      if (isMountedRef.current) {
        const message = err?.message || 'Löschen fehlgeschlagen'
        setDeleteError({ id, message }) // Set error for this specific tutorial
      }
    } finally {
      // Always clear the loading state
      if (isMountedRef.current) {
        setDeletingId(null)
      }
    }
  }

  // === LIFECYCLE EFFECTS ===

  /**
   * Effect to track component mount/unmount state.
   * This prevents state updates on unmounted components during async operations.
   */
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false // Cleanup: mark as unmounted
    }
  }, [])

  /**
   * Closes the tutorial form modal and resets the editing state.
   *
   * @returns {void}
   */
  /**
   * Closes the tutorial form modal and resets the editing state.
   * Resets both form visibility and the tutorial being edited.
   *
   * @returns {void}
   */
  const handleCloseForm = () => {
    setShowForm(false)         // Hide the modal
    setEditingTutorial(null)   // Clear editing state (returns to create mode)
  }

  /**
   * Effect to handle modal keyboard navigation and accessibility.
   * - ESC key closes the modal
   * - Prevents body scrolling when modal is open
   * - Cleans up event listeners on unmount
   */
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showForm) {
        handleCloseForm() // Close modal on ESC key
      }
    }

    if (showForm) {
      // Add keyboard event listener for ESC key
      document.addEventListener('keydown', handleEscape)
      // Prevent background scrolling when modal is open
      document.body.style.overflow = 'hidden'
    }

    // Cleanup function to remove event listeners and restore scrolling
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [showForm]) // Effect depends on modal visibility state

  return (
    // Main container with responsive background and text colors
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100">
      {/* ==================== HEADER SECTION ==================== */}
      {/* Admin dashboard header with user info and navigation */}
      <header className="bg-white/90 dark:bg-slate-900/80 shadow-md backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Left side: Logo and welcome message */}
            <div className="flex items-center space-x-3">
              {/* Terminal icon with gradient background */}
              <div className="bg-gradient-to-r from-primary-600 to-primary-800 p-2 rounded-lg shadow-lg shadow-primary-900/20">
                <Terminal className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Admin Dashboard</h1>
                <p className="text-sm text-gray-600 dark:text-slate-400">Willkommen, {user?.username}</p>
              </div>
            </div>

            {/* Right side: Navigation buttons */}
            <div className="flex space-x-3">
              {/* Return to homepage button */}
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Home className="w-4 h-4" />
                <span>Startseite</span>
              </button>

              {/* Logout button with red styling */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors duration-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
              >
                <LogOut className="w-4 h-4" />
                <span>Abmelden</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ==================== MAIN CONTENT AREA ==================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ==================== TAB NAVIGATION ==================== */}
        {/* Tabbed interface for switching between admin sections */}
        <div className="mb-8 flex flex-col gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tutorials Tab - Default active tab */}
            <button
              type="button"
              onClick={() => setActiveTab('tutorials')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'tutorials'
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20' // Active state
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700' // Inactive state
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Tutorials
            </button>

            {/* Site Content Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'content'
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20' // Active state
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700' // Inactive state
              }`}
            >
              <Paintbrush className="h-4 w-4" />
              Seiteninhalte
            </button>

            {/* Pages & Posts Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('pages')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'pages'
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20' // Active state
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700' // Inactive state
              }`}
            >
              <FileText className="h-4 w-4" />
              Seiten & Beiträge
            </button>
          </div>
        </div>

        {/* ==================== TUTORIALS TAB CONTENT ==================== */}
        {activeTab === 'tutorials' && (
          <>
            {/* ==================== TUTORIAL MANAGEMENT ACTIONS ==================== */}
            {/* Section header and action buttons for tutorial management */}
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Tutorial Verwaltung</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1">Erstelle, bearbeite und verwalte deine Tutorials</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Refresh button - reloads tutorial list with loading state */}
                <button
                  onClick={() => refreshTutorials()}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 disabled:opacity-60"
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Aktualisiere…' : 'Aktualisieren'}</span>
                </button>

                {/* Create new tutorial button - opens modal in create mode */}
                <button
                  onClick={() => {
                    setEditingTutorial(null) // Clear editing state for create mode
                    setShowForm(true)       // Show the form modal
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Plus className="w-5 h-5" />
                  <span>Neues Tutorial</span>
                </button>
              </div>
            </div>

            {/* ==================== ERROR DISPLAY ==================== */}
            {/* Error alert for tutorial loading failures */}
            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 text-red-700" role="alert">
                <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Fehler beim Laden der Tutorials</p>
                  <p className="text-sm">{error?.message || String(error)}</p>
                </div>
              </div>
            )}

            {/* ==================== TUTORIAL FORM MODAL ==================== */}
            {/* Modal overlay for creating/editing tutorials with click-outside-to-close */}
            {showForm && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                onClick={(e) => {
                  // Close modal when clicking the backdrop (but not the modal content)
                  if (e.target === e.currentTarget) {
                    handleCloseForm()
                  }
                }}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                  role="document"
                >
                  {/* Tutorial form component handles both create and edit modes */}
                  <TutorialForm
                    tutorial={editingTutorial} // null for create, tutorial object for edit
                    onClose={handleCloseForm}  // Close handler function
                  />
                </div>
              </div>
            )}

            {/* ==================== TUTORIALS GRID ==================== */}
            {/* Conditional rendering: loading state vs tutorial grid */}
            {loading && tutorials.length === 0 ? (
              // Loading state when no tutorials are loaded yet
              <div className="py-16 text-center text-gray-600">Lade Tutorials…</div>
            ) : (
              // Responsive grid of tutorial cards
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedTutorials.map((tutorial) => (
                  // Individual tutorial card component
                  <div
                    key={tutorial.id}
                    className="rounded-xl border border-gray-100 bg-white shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    {/* Color-coded header strip for visual category identification */}
                    <div className={`h-2 bg-gradient-to-r ${tutorial.color}`}></div>

                    <div className="p-6">
                      {/* Tutorial title */}
                      <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">{tutorial.title}</h3>

                      {/* Tutorial description with line clamp for consistent height */}
                      <p className="text-gray-600 dark:text-slate-300 text-sm mb-4 line-clamp-2">
                        {tutorial.description}
                      </p>

                      {/* Topic tags display */}
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-2">
                          {/* Show up to 3 topic tags */}
                          {(tutorial.topics || []).slice(0, 3).map((topic, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full dark:bg-primary-900/40 dark:text-primary-200"
                            >
                              {topic}
                            </span>
                          ))}
                          {/* Show "more" indicator if there are additional topics */}
                          {tutorial.topics && tutorial.topics.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full dark:bg-slate-800 dark:text-slate-300">
                              +{tutorial.topics.length - 3} mehr
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons for edit and delete */}
                      <div className="flex space-x-2 pt-4 border-t border-gray-100 dark:border-slate-800">
                        {/* Edit button - opens modal in edit mode */}
                        <button
                          onClick={() => handleEdit(tutorial)}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors duration-200 dark:bg-primary-900/40 dark:text-primary-200 dark:hover:bg-primary-900/60"
                        >
                          <Edit className="w-4 h-4" />
                          <span>Bearbeiten</span>
                        </button>

                        {/* Conditional delete confirmation vs delete button */}
                        {confirmingId === tutorial.id ? (
                          // Confirmation state: show confirm and cancel buttons
                          <div className="flex-1 flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleDeleteConfirm(tutorial.id)}
                              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-70 dark:bg-red-600 dark:hover:bg-red-500"
                              disabled={deletingId === tutorial.id}
                            >
                              {deletingId === tutorial.id ? 'Lösche…' : 'Löschen bestätigen'}
                            </button>
                            <button
                              onClick={handleDeleteCancel}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              type="button"
                            >
                              Abbrechen
                            </button>
                          </div>
                        ) : (
                          // Normal state: show delete button
                          <button
                            onClick={() => handleDeleteRequest(tutorial.id)}
                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors duration-200 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Löschen</span>
                          </button>
                        )}
                      </div>

                      {/* Error message display for failed delete operations */}
                      {deleteError?.id === tutorial.id && (
                        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                          {deleteError.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ==================== EMPTY STATE ==================== */}
            {/* Displayed when there are no tutorials to show */}
            {!loading && tutorials.length === 0 && !error && (
              <div className="text-center py-16">
                {/* Terminal icon in circular background */}
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <Terminal className="w-8 h-8 text-gray-400" />
                </div>

                {/* Empty state heading */}
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  Noch keine Tutorials vorhanden
                </h3>

                {/* Empty state description */}
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Erstelle dein erstes Tutorial, um loszulegen.
                </p>

                {/* Call-to-action button to create first tutorial */}
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200"
                >
                  <Plus className="w-5 h-5" />
                  <span>Erstes Tutorial erstellen</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ==================== CONTENT TAB ==================== */}
        {/* Site content management section */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Loading indicator for content editor */}
            {contentLoading && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Inhalte werden geladen…
              </div>
            )}
            {/* Main content editor component */}
            <SiteContentEditor />
          </div>
        )}

        {/* ==================== PAGES TAB ==================== */}
        {/* Dynamic page and post management section */}
        {activeTab === 'pages' && (
          <PageManager />
        )}
      </main>
    </div>
  )
}

export default AdminDashboard
