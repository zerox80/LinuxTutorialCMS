import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MessageSquare, Send, Trash2, ChevronDown, ThumbsUp, ShieldCheck, Smile } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import PropTypes from 'prop-types';
import EmojiPicker from 'emoji-picker-react';

const VALID_TUTORIAL_ID = /^[a-zA-Z0-9_.-]+$/;
const COMMENTS_PER_PAGE = 20;

const Comments = ({ tutorialId, postId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [guestName, setGuestName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'top'
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  const { isAuthenticated, user } = useAuth();
  const isAdmin = Boolean(user && user.role === 'admin');

  const contextId = useMemo(() => {
    const id = tutorialId || postId;
    if (typeof id !== 'string') return null;
    const trimmed = id.trim();
    if (!trimmed || trimmed.length > 100 || !VALID_TUTORIAL_ID.test(trimmed)) return null;
    return trimmed;
  }, [tutorialId, postId]);

  const isPost = Boolean(postId);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadComments = useCallback(async (shouldReset = false) => {
    if (!contextId) {
      setComments([]);
      setLoadError(new Error('Kommentare für diese Ressource sind deaktiviert.'));
      return;
    }

    setLoadingComments(true);
    setLoadError(null);

    try {
      const currentOffset = shouldReset ? 0 : offset;
      let data;

      const params = {
        limit: COMMENTS_PER_PAGE,
        offset: currentOffset,
        sort: sortOrder
      };

      if (isPost) {
        data = await api.listPostComments(contextId, params);
      } else {
        data = await api.listTutorialComments(contextId, params);
      }

      const newComments = Array.isArray(data) ? data : [];

      setComments(prev => shouldReset ? newComments : [...prev, ...newComments]);
      setOffset(prev => shouldReset ? newComments.length : prev + newComments.length);
      setHasMore(newComments.length === COMMENTS_PER_PAGE);

    } catch (error) {
      console.error('Failed to load comments:', error);
      if (shouldReset) setComments([]);
      setLoadError(error);
    } finally {
      setLoadingComments(false);
    }
  }, [contextId, isPost, offset, sortOrder]);

  // Initial load and when sort changes
  useEffect(() => {
    loadComments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId, sortOrder]);

  const handleLoadMore = () => {
    loadComments(false);
  };

  const onEmojiClick = (emojiObject) => {
    setNewComment(prev => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canComment || !newComment.trim()) return;

    if (!isAuthenticated && !guestName.trim()) return;

    setIsLoading(true);
    try {
      if (isPost) {
        await api.createPostComment(contextId, newComment, isAuthenticated ? null : guestName);
      } else {
        await api.createComment(contextId, newComment);
      }

      setNewComment('');
      setGuestName('');
      // Reset and reload to show the new comment at the top
      await loadComments(true);
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!canManageComments) return;
    if (typeof window !== 'undefined' && !window.confirm('Kommentar wirklich löschen?')) return;

    try {
      await api.deleteComment(commentId);
      // Remove from local state to avoid full reload
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleVote = async (commentId) => {
    try {
      const updatedComment = await api.voteComment(commentId);
      setComments(prev => prev.map(c => c.id === commentId ? updatedComment : c));
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  // Guests can comment on posts, but only auth users on tutorials
  const canComment = (isAuthenticated || isPost) && contextId;
  // Only admin or (theoretically) author can delete, but here we check admin for deletion button
  const canManageComments = isAdmin;

  return (
    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          Kommentare
        </h2>

        <div className="relative">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
          >
            <option value="newest">Neueste zuerst</option>
            <option value="top">Beste zuerst</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {canComment ? (
        <form onSubmit={handleSubmit} className="mb-8 relative">
          {!isAuthenticated && (
            <div className="mb-4">
              <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name (erforderlich)
              </label>
              <input
                type="text"
                id="guestName"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full md:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Dein Name"
                maxLength={50}
                required
              />
            </div>
          )}

          <div className="relative">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Schreibe einen Kommentar..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={4}
              maxLength={1000}
              required
            />
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute bottom-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Smile className="w-6 h-6" />
            </button>
          </div>

          {showEmojiPicker && (
            <div className="absolute z-10 mt-2 right-0" ref={emojiPickerRef}>
              <EmojiPicker onEmojiClick={onEmojiClick} theme="auto" />
            </div>
          )}

          <div className="mt-2 flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {newComment.length}/1000
            </span>
            <button
              type="submit"
              disabled={isLoading || !newComment.trim() || (!isAuthenticated && !guestName.trim())}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              Absenden
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Bitte melde dich an, um Kommentare zu schreiben.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {comments.length === 0 && !loadingComments ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            Noch keine Kommentare. Sei der Erste!
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-4 rounded-xl ${comment.is_admin
                  ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800'
                  : 'bg-gray-50 dark:bg-gray-800'
                }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {comment.author}
                  </span>
                  {comment.is_admin && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                      <ShieldCheck className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    {new Date(comment.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVote(comment.id)}
                    className="flex items-center gap-1 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                    title="Gefällt mir"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="text-sm font-medium">{comment.votes || 0}</span>
                  </button>
                  {canManageComments && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      aria-label="Kommentar löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>

      {loadError && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          Kommentare konnten nicht geladen werden.
        </div>
      )}

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingComments}
            className="inline-flex items-center gap-2 px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loadingComments ? (
              'Laden...'
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Mehr Kommentare laden
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

Comments.propTypes = {
  tutorialId: PropTypes.string,
  postId: PropTypes.string,
};

export default Comments;
