// LocalStorage-based progress tracking for tutorials

const STORAGE_KEY = 'tutorial_progress';
const BOOKMARKS_KEY = 'tutorial_bookmarks';

/**
 * Retrieves the user's tutorial progress from localStorage.
 * @returns {object} An object where keys are tutorial IDs and values are progress data.
 */
export const getProgress = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load progress:', error);
    return {};
  }
};

/**
 * Marks a tutorial as read and saves the progress to localStorage.
 * @param {string} tutorialId - The ID of the tutorial to mark as read.
 */
export const markAsRead = (tutorialId) => {
  try {
    const progress = getProgress();
    progress[tutorialId] = {
      read: true,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to save progress:', error);
  }
};

/**
 * Checks if a tutorial has been marked as read.
 * @param {string} tutorialId - The ID of the tutorial to check.
 * @returns {boolean} True if the tutorial is marked as read, otherwise false.
 */
export const isRead = (tutorialId) => {
  const progress = getProgress();
  return progress[tutorialId]?.read || false;
};

/**
 * Clears all tutorial progress from localStorage.
 */
export const clearProgress = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear progress:', error);
  }
};

// Bookmarks
/**
 * Retrieves the user's bookmarked tutorial IDs from localStorage.
 * @returns {Array<string>} An array of bookmarked tutorial IDs.
 */
export const getBookmarks = () => {
  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load bookmarks:', error);
    return [];
  }
};

/**
 * Toggles a bookmark for a given tutorial.
 * If the tutorial is already bookmarked, it will be removed; otherwise, it will be added.
 * @param {string} tutorialId - The ID of the tutorial to toggle the bookmark for.
 * @returns {Array<string>} The updated list of bookmarked tutorial IDs.
 */
export const toggleBookmark = (tutorialId) => {
  try {
    const bookmarks = getBookmarks();
    const index = bookmarks.indexOf(tutorialId);
    
    if (index > -1) {
      bookmarks.splice(index, 1);
    } else {
      bookmarks.push(tutorialId);
    }
    
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    return bookmarks;
  } catch (error) {
    console.error('Failed to toggle bookmark:', error);
    return getBookmarks();
  }
};

/**
 * Checks if a tutorial is bookmarked.
 * @param {string} tutorialId - The ID of the tutorial to check.
 * @returns {boolean} True if the tutorial is bookmarked, otherwise false.
 */
export const isBookmarked = (tutorialId) => {
  const bookmarks = getBookmarks();
  return bookmarks.includes(tutorialId);
};
