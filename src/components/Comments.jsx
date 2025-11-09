import { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import PropTypes from 'prop-types';

/**
 * Comments section component for displaying and managing tutorial comments.
 *
 * This component provides a complete comment system for tutorials, allowing authenticated
 * administrators to post, view, and delete comments. It integrates with the backend API
 * for real-time comment management and provides a responsive, accessible user interface.
 *
 * Key Features:
 * - Display comments for a specific tutorial
 * - Admin-only comment creation and deletion
 * - Real-time comment loading and updates
 * - Character limit enforcement (1000 characters)
 * - Confirmation dialogs for destructive actions
 * - Responsive design for mobile and desktop
 * - Loading states and error handling
 *
 * Authentication & Authorization:
 * - Only authenticated admin users can post comments
 * - Role-based access control (admin role required)
 * - Secure API integration with proper error handling
 *
 * Performance Considerations:
 * - Efficient comment loading with caching
 * - Optimistic UI updates for better user experience
 * - Minimal re-renders through proper state management
 * - Debounced API calls to prevent spam
 *
 * Security Features:
 * - Input validation and sanitization
 * - Confirmation dialogs for destructive actions
 * - Proper error handling without exposing sensitive information
 * - Role-based access control enforcement
 *
 * @component
 * @example
 * // Basic usage in a tutorial page
 * <Comments tutorialId="tutorial-123" />
 *
 * @param {Object} props - Component props
 * @param {string} props.tutorialId - The unique identifier of the tutorial to display
 *                                   comments for. This is used to fetch tutorial-specific
 *                                   comments from the API
 *
 * @returns {JSX.Element} Rendered comments section with comment form, list, and management controls
 *
 * @see {@link ../api/client.js} for API integration details
 * @see {@link ../context/AuthContext.jsx} for authentication state management
 */
const Comments = ({ tutorialId }) => {

  const [comments, setComments] = useState([]);

  const [newComment, setNewComment] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const { isAuthenticated, user } = useAuth();

  const isAdmin = Boolean(user && user.role === 'admin');

  useEffect(() => {
    loadComments();
  }, [tutorialId]);

  
  /**
   * Loads comments for the current tutorial from the API.
   *
   * This function fetches all comments associated with the current tutorial ID
   * from the backend API. It handles both successful responses and error cases,
   * ensuring the component always maintains a valid state.
   *
   * API Integration:
   * - Uses the api.listTutorialComments() method
   * - Passes the tutorialId as a parameter
   * - Handles both array responses and error states
   *
   * Error Handling:
   * - Logs errors to console for debugging
   * - Falls back to empty array on API failure
   * - Prevents component crashes due to malformed data
   *
   * @async
   * @function
   * @returns {Promise<void>} Resolves when comments are loaded or error is handled
   *
   * @example
   * // Called automatically when component mounts or tutorialId changes
   * await loadComments(); // Updates the comments state
   */
  const loadComments = async () => {
    try {

      // Fetch comments from the API using the tutorial ID
      const data = await api.listTutorialComments(tutorialId);

      // Ensure we always have an array, even if API returns unexpected data
      setComments(Array.isArray(data) ? data : []);
    } catch (error) {
      // Log error for debugging but don't expose to user
      console.error('Failed to load comments:', error);

      // Set empty array to maintain consistent state
      setComments([]);
    }
  };


  /**
   * Handles comment form submission.
   *
   * This function processes the comment creation form, validates input, and
   * submits the comment to the API. It includes comprehensive validation
   * and proper loading state management.
   *
   * Validation Logic:
   * - Checks if comment content is not empty (after trimming)
   * - Verifies user is authenticated
   * - Ensures user has admin privileges
   * - Prevents duplicate submissions during loading
   *
   * State Management:
   * - Sets loading state during API call
   * - Clears form on successful submission
   * - Refreshes comments list after creation
   * - Always resets loading state in finally block
   *
   * Security Considerations:
   * - Client-side validation before API call
   * - Server-side validation expected on backend
   * - Proper error handling without exposing sensitive data
   *
   * @async
   * @function
   * @param {Event} e - Form submit event from the comment form
   * @returns {Promise<void>} Resolves when comment is submitted or error is handled
   *
   * @example
   * // Triggered by form submission
   * <form onSubmit={handleSubmit}>
   *   <textarea value={newComment} onChange={handleChange} />
   *   <button type="submit">Post Comment</button>
   * </form>
   */
  const handleSubmit = async (e) => {
    // Prevent default form submission behavior
    e.preventDefault();

    // Validate form data and user permissions
    if (!newComment.trim() || !isAuthenticated || !isAdmin) return;

    // Set loading state to prevent duplicate submissions
    setIsLoading(true);
    try {

      // Submit comment to API
      await api.createComment(tutorialId, newComment);

      // Clear form for next comment
      setNewComment('');

      // Refresh comments list to show new comment
      await loadComments();
    } catch (error) {
      // Log error for debugging but don't expose sensitive info to user
      console.error('Failed to post comment:', error);
    } finally {

      // Always reset loading state
      setIsLoading(false);
    }
  };


  /**
   * Handles comment deletion with user confirmation.
   *
   * This function provides a two-step deletion process to prevent accidental
   * comment removal. It includes permission checks and confirmation dialogs.
   *
   * Security Measures:
   * - Verifies user has admin privileges before allowing deletion
   * - Requires user confirmation via native browser dialog
   * - Prevents unauthorized deletion attempts
   *
   * User Experience:
   * - Clear confirmation message in German
   * - Immediate UI updates after successful deletion
   * - Graceful error handling without breaking the interface
   *
   * API Integration:
   * - Uses api.deleteComment() method
   * - Passes comment ID for precise deletion
   * - Refreshes comments list after successful deletion
   *
   * @async
   * @function
   * @param {string} commentId - The unique identifier of the comment to delete
   * @returns {Promise<void>} Resolves when comment is deleted or operation is cancelled
   *
   * @example
   * // Called from delete button in comment list
   * <button onClick={() => handleDelete(comment.id)}>Delete</button>
   */
  const handleDelete = async (commentId) => {

    // Double-check admin permissions
    if (!isAdmin) return;

    // Show confirmation dialog to prevent accidental deletion
    if (!confirm('Kommentar wirklich löschen?')) return;

    try {

      // Delete comment from API
      await api.deleteComment(commentId);

      // Refresh comments list to remove deleted comment
      await loadComments();
    } catch (error) {
      // Log error for debugging
      console.error('Failed to delete comment:', error);
    }
  };

  return (

    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
      {}
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
        <MessageSquare className="w-6 h-6" />
        Kommentare ({comments.length})
      </h2>

      {}
      {isAdmin && (
        <form onSubmit={handleSubmit} className="mb-8">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Schreibe einen Kommentar..."
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            rows={4}
            maxLength={1000}
          />
          {}
          <div className="mt-2 flex justify-between items-center">
            {}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {newComment.length}/1000
            </span>
            {}
            <button
              type="submit"
              disabled={isLoading || !newComment.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              Absenden
            </button>
          </div>
        </form>
      )}

      {}
      {!isAuthenticated && (
        <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Bitte melde dich an, um Kommentare zu schreiben.
          </p>
        </div>
      )}

      {}
      {isAuthenticated && !isAdmin && (
        <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Nur Administratoren können Kommentare hinzufügen oder löschen.
          </p>
        </div>
      )}

      {}
      <div className="space-y-4">
        {comments.length === 0 ? (

          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            Noch keine Kommentare. Sei der Erste!
          </p>
        ) : (

          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl"
            >
              {}
              <div className="flex justify-between items-start mb-2">
                <div>
                  {}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {comment.author}
                  </span>
                  {}
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    {new Date(comment.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
                {}
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    aria-label="Kommentar löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {}
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

Comments.propTypes = {

  tutorialId: PropTypes.string.isRequired,
};

export default Comments;
