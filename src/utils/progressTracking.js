// LocalStorage-based progress tracking for tutorials

const STORAGE_KEY = 'tutorial_progress';
const BOOKMARKS_KEY = 'tutorial_bookmarks';

export const getProgress = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load progress:', error);
    return {};
  }
};

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

export const isRead = (tutorialId) => {
  const progress = getProgress();
  return progress[tutorialId]?.read || false;
};

export const clearProgress = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear progress:', error);
  }
};

// Bookmarks
export const getBookmarks = () => {
  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load bookmarks:', error);
    return [];
  }
};

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

export const isBookmarked = (tutorialId) => {
  const bookmarks = getBookmarks();
  return bookmarks.includes(tutorialId);
};
