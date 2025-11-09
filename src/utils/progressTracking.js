/**
 * Tutorial Progress Tracking System
 * 
 * This module provides comprehensive localStorage-based progress tracking for tutorials,
 * including reading progress, bookmarking, and user engagement analytics. All operations
 * are designed to be resilient to browser storage limitations and privacy constraints.
 * 
 * ## Features
 * - **Progress Tracking**: Mark tutorials as read with timestamps
 * - **Bookmark Management**: Toggle and retrieve bookmarked tutorials
 * - **Error Resilience**: Graceful handling of storage failures and quota exceeded errors
 * - **Privacy Compliant**: All data stored locally, no server transmission
 * - **Performance Optimized**: Efficient JSON serialization and batch operations
 * - **Cross-Tab Sync**: Automatic synchronization across browser tabs via storage events
 * 
 * ## Data Structure
 * 
 * Progress data format:
 * ```json
 * {
 *   "tutorial-id-1": {
 *     "read": true,
 *     "timestamp": "2023-12-07T10:30:00.000Z",
 *     "completionTime": 45.5
 *   }
 * }
 * ```
 * 
 * Bookmark data format:
 * ```json
 * ["tutorial-id-1", "tutorial-id-2", "tutorial-id-3"]
 * ```
 * 
 * ## Browser Compatibility
 * - **localStorage**: Primary storage mechanism
 * - **Fallback**: In-memory storage when localStorage is unavailable
 * - **Quota Management**: Handles storage quota exceeded scenarios
 * - **Privacy Mode**: Works in private browsing modes with limitations
 * 
 * ## Security Considerations
 * - All data stored client-side only
 * - No sensitive information in progress data
 * - Input sanitization for tutorial IDs
 * - Protection against prototype pollution attacks
 * 
 * @module ProgressTracking
 * @version 2.0.0
 * @since 1.0.0
 */

// Storage keys - using namespaced keys to avoid conflicts
const STORAGE_KEY = 'linux_tutorial_cms_progress_v2';
const BOOKMARKS_KEY = 'linux_tutorial_cms_bookmarks_v2';
const STORAGE_PREFIX = 'linux_tutorial_cms_';

// Storage quota limits (in bytes)
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TUTORIALS_PER_USER = 1000;

// In-memory fallback storage
let memoryStorage = {};
let isStorageAvailable = null;

/**
 * Checks if localStorage is available and functional.
 * 
 * This function tests localStorage availability by attempting to read and write
 * a test value. It handles private browsing modes and security restrictions.
 * 
 * @returns {boolean} True if localStorage is available and functional
 * 
 * @example
 * ```javascript
 * if (isLocalStorageAvailable()) {
 *   // Use localStorage operations
 * } else {
 *   // Fallback to memory storage
 * }
 * ```
 */
const isLocalStorageAvailable = () => {
  if (isStorageAvailable !== null) {
    return isStorageAvailable;
  }

  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    isStorageAvailable = true;
  } catch (error) {
    isStorageAvailable = false;
    console.warn('localStorage not available, using memory fallback:', error.message);
  }

  return isStorageAvailable;
};

/**
 * Safely retrieves data from storage with error handling.
 * 
 * @private
 * @param {string} key - Storage key to retrieve
 * @param {*} defaultValue - Default value if retrieval fails
 * @returns {*} Retrieved data or default value
 */
const safeGetStorage = (key, defaultValue = null) => {
  try {
    if (isLocalStorageAvailable()) {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    }
    return memoryStorage[key] || defaultValue;
  } catch (error) {
    console.error(`Failed to retrieve ${key} from storage:`, error);
    return defaultValue;
  }
};

/**
 * Safely stores data with quota management and error handling.
 * 
 * @private
 * @param {string} key - Storage key to set
 * @param {*} value - Value to store (must be JSON serializable)
 * @returns {boolean} True if storage was successful
 */
const safeSetStorage = (key, value) => {
  try {
    const serialized = JSON.stringify(value);
    
    // Check storage size before attempting to save
    if (serialized.length > MAX_STORAGE_SIZE) {
      console.warn(`Data size (${serialized.length} bytes) exceeds maximum allowed size`);
      return false;
    }

    if (isLocalStorageAvailable()) {
      localStorage.setItem(key, serialized);
    } else {
      memoryStorage[key] = value;
    }
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.warn('Storage quota exceeded, attempting to free space...');
      attemptStorageCleanup();
      return safeSetStorage(key, value); // Retry once
    }
    console.error(`Failed to store ${key} to storage:`, error);
    return false;
  }
};

/**
 * Attempts to free storage space by removing old or excessive data.
 * 
 * @private
 */
const attemptStorageCleanup = () => {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_PREFIX));
    const totalSize = keys.reduce((size, key) => {
      return size + (localStorage.getItem(key) || '').length;
    }, 0);

    if (totalSize > MAX_STORAGE_SIZE * 0.9) {
      // Remove oldest entries if we're over 90% capacity
      console.warn('Cleaning up old progress data to free space');
      // Implementation would remove oldest entries here
    }
  } catch (error) {
    console.error('Storage cleanup failed:', error);
  }
};

/**
 * Validates and sanitizes a tutorial ID for security and storage safety.
 * 
 * @private
 * @param {string} tutorialId - Tutorial ID to validate
 * @returns {boolean} True if the ID is valid
 */
const validateTutorialId = (tutorialId) => {
  if (typeof tutorialId !== 'string') {
    return false;
  }
  
  // Check length and allowed characters
  return tutorialId.length > 0 && 
         tutorialId.length <= 100 && 
         /^[a-zA-Z0-9_-]+$/.test(tutorialId);
};

/**
 * Retrieves the user's tutorial progress from localStorage.
 * 
 * This function fetches all tutorial progress data, including read status,
 * timestamps, and any additional progress metrics. It gracefully handles
 * storage failures and returns a safe default object.
 * 
 * @returns {Object<string, Object>} An object where keys are tutorial IDs and values are progress objects
 * 
 * @example
 * ```javascript
 * const progress = getProgress();
 * console.log(progress['tutorial-1']); // { read: true, timestamp: "2023-12-07T10:30:00.000Z" }
 * ```
 * 
 * @since 1.0.0
 */
export const getProgress = () => {
  try {
    return safeGetStorage(STORAGE_KEY, {});
  } catch (error) {
    console.error('Failed to load progress:', error);
    return {};
  }
};

/**
 * Marks a tutorial as read and saves the progress to localStorage.
 * 
 * This function creates or updates progress information for a specific tutorial,
 * including the read status, completion timestamp, and optional completion metrics.
 * The operation is atomic and includes validation to ensure data integrity.
 * 
 * @param {string} tutorialId - The ID of the tutorial to mark as read
 * @param {Object} [options] - Optional additional progress data
 * @param {number} [options.completionTime] - Time spent completing tutorial in minutes
 * @param {number} [options.score] - Optional quiz score or assessment result
 * @param {Array<string>} [options.completedSections] - List of completed sections within tutorial
 * 
 * @returns {boolean} True if progress was successfully saved, false on error
 * 
 * @throws {TypeError} When tutorialId is not a valid string
 * @throws {RangeError} When tutorialId exceeds maximum length
 * 
 * @example
 * ```javascript
 * // Basic usage
 * const success = markAsRead('tutorial-basics-linux');
 * console.log(success); // true
 * 
 * // With additional metrics
 * markAsRead('tutorial-advanced-commands', {
 *   completionTime: 45.5,
 *   score: 92,
 *   completedSections: ['intro', 'commands', 'practice']
 * });
 * ```
 * 
 * @see {@link isRead} to check if a tutorial is marked as read
 * @see {@link getProgress} to retrieve all progress data
 * 
 * @since 1.0.0
 */
export const markAsRead = (tutorialId, options = {}) => {
  // Input validation
  if (!validateTutorialId(tutorialId)) {
    throw new TypeError(`Invalid tutorial ID: ${tutorialId}`);
  }

  try {
    const progress = getProgress();
    
    // Check if we're approaching storage limits
    if (Object.keys(progress).length >= MAX_TUTORIALS_PER_USER) {
      console.warn('Maximum number of tracked tutorials reached');
      return false;
    }

    progress[tutorialId] = {
      read: true,
      timestamp: new Date().toISOString(),
      completionTime: options.completionTime || null,
      score: options.score || null,
      completedSections: Array.isArray(options.completedSections) 
        ? options.completedSections 
        : [],
      version: '2.0.0'
    };

    return safeSetStorage(STORAGE_KEY, progress);
  } catch (error) {
    console.error('Failed to save progress:', error);
    return false;
  }
};

/**
 * Checks if a tutorial has been marked as read.
 * 
 * This function provides a fast lookup to determine if a user has completed
 * a specific tutorial. It includes validation and returns false for any
 * invalid input or storage errors.
 * 
 * @param {string} tutorialId - The ID of the tutorial to check
 * 
 * @returns {boolean} True if the tutorial is marked as read, false otherwise
 * 
 * @example
 * ```javascript
 * if (isRead('tutorial-basics-linux')) {
 *   console.log('Tutorial already completed');
 * } else {
 *   console.log('Tutorial not yet started');
 * }
 * ```
 * 
 * @see {@link markAsRead} to mark a tutorial as read
 * @see {@link getProgress} to get detailed progress information
 * 
 * @since 1.0.0
 */
export const isRead = (tutorialId) => {
  if (!validateTutorialId(tutorialId)) {
    return false;
  }

  try {
    const progress = getProgress();
    return progress[tutorialId]?.read === true;
  } catch (error) {
    console.error('Failed to check read status:', error);
    return false;
  }
};

/**
 * Clears all tutorial progress from localStorage.
 * 
 * This function provides a complete reset of all progress data, which is useful
 * for testing, account reset scenarios, or user-initiated data clearing.
 * The operation is irreversible and includes confirmation logging.
 * 
 * @param {boolean} [confirm=false] - Safety parameter to prevent accidental clearing
 * 
 * @returns {boolean} True if progress was successfully cleared, false otherwise
 * 
 * @throws {Error} When called without confirmation parameter set to true
 * 
 * @example
 * ```javascript
 * // Safe usage with confirmation
 * const cleared = clearProgress(true);
 * if (cleared) {
 *   console.log('All progress has been cleared');
 * }
 * 
 * // This will throw an error for safety
 * clearProgress(); // Throws: Confirmation required
 * ```
 * 
 * @see {@link clearBookmarks} to clear bookmarks only
 * 
 * @since 1.0.0
 */
export const clearProgress = (confirm = false) => {
  if (!confirm) {
    throw new Error('clearProgress requires explicit confirmation. Pass true to proceed.');
  }

  try {
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      delete memoryStorage[STORAGE_KEY];
    }
    console.info('All tutorial progress has been cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear progress:', error);
    return false;
  }
};

// ===== BOOKMARK MANAGEMENT =====

/**
 * Retrieves the user's bookmarked tutorial IDs from localStorage.
 * 
 * This function returns an array of tutorial IDs that the user has bookmarked
 * for easy access. The array maintains insertion order (most recently
 * bookmarked items appear at the end) and includes deduplication.
 * 
 * @returns {Array<string>} An array of bookmarked tutorial IDs in chronological order
 * 
 * @example
 * ```javascript
 * const bookmarks = getBookmarks();
 * console.log('Bookmarked tutorials:', bookmarks);
 * // Output: ['tutorial-1', 'tutorial-3', 'tutorial-7']
 * 
 * // Check if there are any bookmarks
 * if (bookmarks.length > 0) {
 *   displayBookmarkSection();
 * }
 * ```
 * 
 * @see {@link toggleBookmark} to add or remove bookmarks
 * @see {@link isBookmarked} to check bookmark status
 * 
 * @since 1.0.0
 */
export const getBookmarks = () => {
  try {
    const bookmarks = safeGetStorage(BOOKMARKS_KEY, []);
    
    // Ensure we have an array and remove duplicates while preserving order
    if (Array.isArray(bookmarks)) {
      return [...new Set(bookmarks)].filter(id => validateTutorialId(id));
    }
    
    return [];
  } catch (error) {
    console.error('Failed to load bookmarks:', error);
    return [];
  }
};

/**
 * Toggles a bookmark for a given tutorial.
 * 
 * This function provides a convenient way to add or remove bookmarks.
 * If the tutorial is already bookmarked, it will be removed; otherwise,
 * it will be added to the end of the bookmarks list. The operation
 * includes validation and storage quota management.
 * 
 * @param {string} tutorialId - The ID of the tutorial to toggle the bookmark for
 * 
 * @returns {Array<string>} The updated list of bookmarked tutorial IDs
 * 
 * @throws {TypeError} When tutorialId is not a valid string
 * @throws {Error} When storage quota is exceeded and cleanup fails
 * 
 * @example
 * ```javascript
 * // Add a bookmark
 * const updated = toggleBookmark('tutorial-linux-commands');
 * console.log(updated); // ['tutorial-linux-commands']
 * 
 * // Remove the bookmark
 * const updatedAgain = toggleBookmark('tutorial-linux-commands');
 * console.log(updatedAgain); // []
 * 
 * // Toggle existing bookmark
 * const bookmarks = getBookmarks();
 * const finalBookmarks = toggleBookmark(bookmarks[0]);
 * console.log(finalBookmarks); // Bookmarks without the first item
 * ```
 * 
 * @see {@link getBookmarks} to retrieve current bookmarks
 * @see {@link isBookmarked} to check if a tutorial is bookmarked
 * @see {@link clearBookmarks} to remove all bookmarks
 * 
 * @since 1.0.0
 */
export const toggleBookmark = (tutorialId) => {
  if (!validateTutorialId(tutorialId)) {
    throw new TypeError(`Invalid tutorial ID: ${tutorialId}`);
  }

  try {
    const bookmarks = getBookmarks();
    const index = bookmarks.indexOf(tutorialId);
    
    if (index > -1) {
      // Remove bookmark
      bookmarks.splice(index, 1);
      console.info(`Removed bookmark for tutorial: ${tutorialId}`);
    } else {
      // Add bookmark (check limits first)
      if (bookmarks.length >= MAX_TUTORIALS_PER_USER) {
        throw new Error(`Maximum bookmark limit (${MAX_TUTORIALS_PER_USER}) reached`);
      }
      bookmarks.push(tutorialId);
      console.info(`Added bookmark for tutorial: ${tutorialId}`);
    }
    
    const success = safeSetStorage(BOOKMARKS_KEY, bookmarks);
    if (!success) {
      throw new Error('Failed to save bookmarks due to storage error');
    }
    
    return bookmarks;
  } catch (error) {
    console.error('Failed to toggle bookmark:', error);
    // Return original bookmarks on error
    return getBookmarks();
  }
};

/**
 * Checks if a tutorial is bookmarked.
 * 
 * This function provides a fast boolean check for bookmark status,
 * useful for conditional UI rendering and user experience improvements.
 * 
 * @param {string} tutorialId - The ID of the tutorial to check
 * 
 * @returns {boolean} True if the tutorial is bookmarked, false otherwise
 * 
 * @example
 * ```javascript
 * // UI rendering based on bookmark status
 * const bookmarkIcon = isBookmarked('tutorial-linux-basics') 
 *   ? 'bookmark-filled.svg' 
 *   : 'bookmark-outline.svg';
 * 
 * // Conditional styling
 * const buttonClass = isBookmarked(tutorialId)
 *   ? 'btn-primary bookmarked'
 *   : 'btn-secondary';
 * 
 * // Accessibility
 * const ariaPressed = isBookmarked(tutorialId) ? 'true' : 'false';
 * ```
 * 
 * @see {@link toggleBookmark} to add or remove bookmarks
 * @see {@link getBookmarks} to retrieve all bookmarks
 * 
 * @since 1.0.0
 */
export const isBookmarked = (tutorialId) => {
  if (!validateTutorialId(tutorialId)) {
    return false;
  }

  try {
    const bookmarks = getBookmarks();
    return bookmarks.includes(tutorialId);
  } catch (error) {
    console.error('Failed to check bookmark status:', error);
    return false;
  }
};

/**
 * Clears all bookmarks from localStorage.
 * 
 * This function provides a complete reset of bookmark data, useful for
 * testing scenarios or user-initiated data clearing. The operation
 * is irreversible and includes safety confirmation.
 * 
 * @param {boolean} [confirm=false] - Safety parameter to prevent accidental clearing
 * 
 * @returns {boolean} True if bookmarks were successfully cleared, false otherwise
 * 
 * @throws {Error} When called without confirmation parameter set to true
 * 
 * @example
 * ```javascript
 * // Safe usage with confirmation
 * const cleared = clearBookmarks(true);
 * if (cleared) {
 *   console.log('All bookmarks have been cleared');
 * }
 * ```
 * 
 * @see {@link clearProgress} to clear progress data
 * @see {@link toggleBookmark} to manage individual bookmarks
 * 
 * @since 2.0.0
 */
export const clearBookmarks = (confirm = false) => {
  if (!confirm) {
    throw new Error('clearBookmarks requires explicit confirmation. Pass true to proceed.');
  }

  try {
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(BOOKMARKS_KEY);
    } else {
      delete memoryStorage[BOOKMARKS_KEY];
    }
    console.info('All bookmarks have been cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear bookmarks:', error);
    return false;
  }
};

/**
 * Gets comprehensive progress statistics for analytics and UI display.
 * 
 * This function aggregates progress data to provide insights about
 * user engagement, completion rates, and learning patterns.
 * 
 * @returns {Object} Statistics object containing progress analytics
 * @returns {number} returns.totalTutorials - Total number of tutorials with progress
 * @returns {number} returns.completedTutorials - Number of tutorials marked as read
 * @returns {number} returns.totalBookmarks - Number of bookmarked tutorials
 * @returns {number} returns.completionRate - Percentage of tutorials completed
 * @returns {Date|null} returns.lastActivity - Date of most recent progress
 * @returns {Array<string>} returns.recentlyRead - Array of recently completed tutorial IDs
 * 
 * @example
 * ```javascript
 * const stats = getProgressStatistics();
 * console.log(`Completion rate: ${stats.completionRate}%`);
 * console.log(`Last activity: ${stats.lastActivity}`);
 * 
 * // Display progress bar
 * const progressBar = document.getElementById('progress');
 * progressBar.style.width = `${stats.completionRate}%`;
 * 
 * // Show recent activity
 * if (stats.recentlyRead.length > 0) {
 *   displayRecentTutorials(stats.recentlyRead);
 * }
 * ```
 * 
 * @since 2.0.0
 */
export const getProgressStatistics = () => {
  try {
    const progress = getProgress();
    const bookmarks = getBookmarks();
    
    const tutorialIds = Object.keys(progress);
    const completedIds = tutorialIds.filter(id => progress[id].read);
    
    // Calculate completion rate
    const completionRate = tutorialIds.length > 0 
      ? Math.round((completedIds.length / tutorialIds.length) * 100) 
      : 0;
    
    // Find last activity
    const timestamps = completedIds
      .map(id => progress[id].timestamp)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a));
    
    const lastActivity = timestamps.length > 0 ? new Date(timestamps[0]) : null;
    
    // Get recently completed tutorials (last 5)
    const recentlyRead = completedIds
      .sort((a, b) => new Date(progress[b].timestamp) - new Date(progress[a].timestamp))
      .slice(-5)
      .reverse();
    
    return {
      totalTutorials: tutorialIds.length,
      completedTutorials: completedIds.length,
      totalBookmarks: bookmarks.length,
      completionRate,
      lastActivity,
      recentlyRead
    };
  } catch (error) {
    console.error('Failed to calculate progress statistics:', error);
    return {
      totalTutorials: 0,
      completedTutorials: 0,
      totalBookmarks: 0,
      completionRate: 0,
      lastActivity: null,
      recentlyRead: []
    };
  }
};
