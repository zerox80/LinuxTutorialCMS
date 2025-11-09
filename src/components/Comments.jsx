import { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import PropTypes from 'prop-types';

/**
 * Renders the comments section for a tutorial, including a form to add new comments
 * and a list of existing comments.
 *
 * @param {object} props - The component props.
 * @param {string} props.tutorialId - The ID of the tutorial to load comments for.
 * @returns {JSX.Element} The rendered comments section.
 */
const Comments = ({ tutorialId }) => {
  // State for storing the list of comments for this tutorial
  const [comments, setComments] = useState([]);
  // State for the new comment form input
  const [newComment, setNewComment] = useState('');
  // Loading state for form submission to prevent double-clicks
  const [isLoading, setIsLoading] = useState(false);
  // Get authentication status and user data from context
  const { isAuthenticated, user } = useAuth();
  // Derive admin status from user role - only admins can comment/delete
  const isAdmin = Boolean(user && user.role === 'admin');

  // Load comments whenever the tutorial ID changes
  useEffect(() => {
    loadComments();
  }, [tutorialId]);

  /**
   * Loads comments for the specified tutorial from the API.
   *
   * Fetches all comments associated with the current tutorial and updates
   * the component state. If the API call fails, logs the error and sets
   * comments to an empty array.
   *
   * @returns {Promise<void>} A promise that resolves when comments are loaded or rejects on error.
   */
  const loadComments = async () => {
    try {
      // Fetch comments from the API for this specific tutorial
      const data = await api.listTutorialComments(tutorialId);
      // Ensure we always set an array, even if API returns unexpected data
      setComments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load comments:', error);
      // Reset to empty array on error to prevent UI crashes
      setComments([]);
    }
  };

  /**
   * Handles the submission of a new comment form.
   *
   * Validates the form data, submits the comment to the API, and refreshes
   * the comments list. Only admin users can submit comments.
   *
   * @param {React.FormEvent} e - The form submission event.
   * @returns {Promise<void>} A promise that resolves when the comment is submitted or rejects on error.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Early return for validation - prevent empty comments and unauthorized access
    if (!newComment.trim() || !isAuthenticated || !isAdmin) return;

    // Set loading state to prevent multiple submissions
    setIsLoading(true);
    try {
      // Create the comment via API
      await api.createComment(tutorialId, newComment);
      // Clear the form input
      setNewComment('');
      // Refresh the comments list to show the new comment
      await loadComments();
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      // Always reset loading state, even on error
      setIsLoading(false);
    }
  };

  /**
   * Handles the deletion of a comment.
   *
   * Shows a confirmation dialog, then deletes the specified comment from the API.
   * Only admin users can delete comments. Refreshes the comments list after successful deletion.
   *
   * @param {string} commentId - The ID of the comment to delete.
   * @returns {Promise<void>} A promise that resolves when the comment is deleted or rejects on error.
   */
  const handleDelete = async (commentId) => {
    // Only admins can delete comments
    if (!isAdmin) return;
    // Show confirmation dialog in German (matches UI language)
    if (!confirm('Kommentar wirklich löschen?')) return;

    try {
      // Delete the comment via API
      await api.deleteComment(commentId);
      // Refresh the comments list to remove the deleted comment
      await loadComments();
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  return (
    // Main container with top border to separate from tutorial content
    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
      {/* Section header with comment count */}
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
        <MessageSquare className="w-6 h-6" />
        Kommentare ({comments.length})
      </h2>

      {/* Comment Form - only shown to admin users */}
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
          {/* Form controls with character counter and submit button */}
          <div className="mt-2 flex justify-between items-center">
            {/* Character counter showing current/maximum length */}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {newComment.length}/1000
            </span>
            {/* Submit button with loading state and validation */}
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

      {/* Message for non-authenticated users */}
      {!isAuthenticated && (
        <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Bitte melde dich an, um Kommentare zu schreiben.
          </p>
        </div>
      )}

      {/* Message for authenticated non-admin users */}
      {isAuthenticated && !isAdmin && (
        <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Nur Administratoren können Kommentare hinzufügen oder löschen.
          </p>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          // Empty state message when no comments exist
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            Noch keine Kommentare. Sei der Erste!
          </p>
        ) : (
          // Render each comment in the list
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl"
            >
              {/* Comment header with author info and delete button */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  {/* Author name */}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {comment.author}
                  </span>
                  {/* Formatted creation date in German locale */}
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    {new Date(comment.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
                {/* Delete button - only visible to admins */}
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
              {/* Comment content - preserves line breaks and whitespace */}
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

// Prop type validation for development-time error checking
Comments.propTypes = {
  // tutorialId is required to fetch comments for the correct tutorial
  tutorialId: PropTypes.string.isRequired,
};

export default Comments;
