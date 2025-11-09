import { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import PropTypes from 'prop-types';

const Comments = ({ tutorialId }) => {

  const [comments, setComments] = useState([]);

  const [newComment, setNewComment] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const { isAuthenticated, user } = useAuth();

  const isAdmin = Boolean(user && user.role === 'admin');

  useEffect(() => {
    loadComments();
  }, [tutorialId]);

  
  const loadComments = async () => {
    try {

      const data = await api.listTutorialComments(tutorialId);

      setComments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load comments:', error);

      setComments([]);
    }
  };

  
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!newComment.trim() || !isAuthenticated || !isAdmin) return;

    setIsLoading(true);
    try {

      await api.createComment(tutorialId, newComment);

      setNewComment('');

      await loadComments();
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {

      setIsLoading(false);
    }
  };

  
  const handleDelete = async (commentId) => {

    if (!isAdmin) return;

    if (!confirm('Kommentar wirklich löschen?')) return;

    try {

      await api.deleteComment(commentId);

      await loadComments();
    } catch (error) {
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
