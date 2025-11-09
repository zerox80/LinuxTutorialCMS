/**
 * Service Worker for LinuxTutorialCMS Progressive Web App (PWA)
 *
 * This service worker enables offline functionality, improved performance,
 * and native app-like behavior for the Linux Tutorial CMS application.
 *
 * Features:
 * - Offline caching of static assets
 * - Network-first strategy for API calls
 * - Cache-first strategy for static resources
 * - Automatic cache cleanup on updates
 * - Fallback pages for offline scenarios
 *
 * @version 1.0.0
 * @author LinuxTutorialCMS Team
 */

// ==============================================================================
// CACHE CONFIGURATION
// ==============================================================================

/**
 * Cache version identifier - increment when updating cached assets
 * Format: {app-name}-v{version}
 * Update this value when deploying new versions to force cache refresh
 */
const CACHE_NAME = 'linux-tutorial-v1';

/**
 * List of static assets to cache during service worker installation
 * These are the core assets needed for basic offline functionality
 *
 * Consider adding:
 * - CSS and JS bundles (after build process)
 * - Critical images and icons
 * - Offline fallback pages
 * - Localized content files
 */
const urlsToCache = [
  '/',                    // Application root
  '/index.html',          // Main HTML file
  '/linux-icon.svg',      // Application icon
  '/manifest.json',       // PWA manifest
  // Add additional static assets as needed:
  // '/static/css/main.css',
  // '/static/js/main.js',
  // '/offline.html',       // Offline fallback page
];

// ==============================================================================
// SERVICE WORKER LIFECYCLE EVENTS
// ==============================================================================

/**
 * INSTALL EVENT
 *
 * Triggered when the service worker is first registered or updated.
 * This is the ideal time to pre-cache critical assets for offline use.
 *
 * Performance Considerations:
 * - Large cache lists can slow down installation
 * - Consider precaching only essential assets
 * - Use runtime caching for non-critical resources
 *
 * Error Handling:
 * - Failed cache additions should be logged for debugging
 * - Installation should complete even if some assets fail to cache
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker - caching core assets');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log(`[SW] Cache opened: ${CACHE_NAME}`);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Core assets cached successfully');
        // Force the new service worker to become active immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache core assets:', error);
        // Still allow installation to continue
      })
  );
});

/**
 * ACTIVATE EVENT
 *
 * Triggered when the service worker becomes active after installation.
 * This event is used for cleanup operations like removing old caches.
 *
 * Cache Management Strategy:
 * - Remove caches with different names (old versions)
 * - Keep only the current cache version
 * - This ensures users get the latest content after updates
 *
 * Performance Impact:
 * - Cache cleanup is performed asynchronously
 * - Old caches are removed to free up storage space
 * - New cache is already prepared during install phase
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker - cleaning up old caches');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        console.log('[SW] Current caches:', cacheNames);

        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Remove caches that don't match the current version
              const shouldDelete = cacheName !== CACHE_NAME;
              if (shouldDelete) {
                console.log(`[SW] Deleting old cache: ${cacheName}`);
              }
              return shouldDelete;
            })
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => {
        console.log('[SW] Cache cleanup completed');
        // Take control of all open pages immediately
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('[SW] Error during cache cleanup:', error);
      })
  );
});

// ==============================================================================
// FETCH EVENT - REQUEST HANDLING
// ==============================================================================

/**
 * FETCH EVENT
 *
 * Intercepts all network requests made by the application.
 * Implements different caching strategies based on request type.
 *
 * Security Considerations:
 * - Only cache same-origin requests
 * - Never cache sensitive API responses
 * - Validate response headers before caching
 *
 * Caching Strategies:
 * 1. Network-first for API calls (ensure fresh data)
 * 2. Cache-first for static assets (better performance)
 * 3. Fallback to offline page for document requests
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;

  // Skip cross-origin requests for security
  if (!url.startsWith(self.location.origin)) {
    console.log(`[SW] Skipping cross-origin request: ${url}`);
    return;
  }

  // ========================================================================
  // API REQUESTS - NETWORK-FIRST STRATEGY
  // ========================================================================

  /**
   * Network-first strategy for API calls ensures data freshness
   * Falls back to cache only when network is unavailable
   *
   Use Cases:
   - User authentication
   - Content management operations
   - Real-time data fetching
   - Form submissions
   */
  if (url.includes('/api/')) {
    console.log(`[SW] API request (network-first): ${url}`);

    event.respondWith(
      fetch(request)
        .then((response) => {
          // Optional: Cache successful API responses for offline fallback
          if (response.ok && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone))
              .catch((error) => console.log('[SW] Failed to cache API response:', error));
          }
          return response;
        })
        .catch((error) => {
          console.log(`[SW] Network failed, trying cache for: ${url}`);
          // Fallback to cached API response
          return caches.match(request);
        })
    );
    return;
  }

  // ========================================================================
  // STATIC ASSETS - CACHE-FIRST STRATEGY
  // ========================================================================

  /**
   * Cache-first strategy for static assets provides better performance
   * Serves from cache when available, falls back to network
   *
   Asset Types:
   - HTML pages
   - CSS stylesheets
   - JavaScript files
   - Images and icons
   - Font files
   */
  console.log(`[SW] Static request (cache-first): ${url}`);

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          console.log(`[SW] Serving from cache: ${url}`);
          return cachedResponse;
        }

        // Otherwise fetch from network
        console.log(`[SW] Fetching from network: ${url}`);
        return fetch(request)
          .then((response) => {
            // Cache successful responses for future use
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone))
                .catch((error) => console.log('[SW] Failed to cache response:', error));
            }
            return response;
          });
      })
      .catch((error) => {
        console.log(`[SW] Network and cache failed for: ${url}`);

        // ====================================================================
        // OFFLINE FALLBACKS
        // ====================================================================

        /**
         * Provide fallback content when offline and resource not cached
         * Different fallbacks based on request type
         */

        // For document requests (HTML pages), serve main app
        if (request.destination === 'document') {
          console.log('[SW] Serving offline fallback page');
          return caches.match('/index.html');
        }

        // For image requests, could serve a placeholder image
        if (request.destination === 'image') {
          // Return a 1x1 transparent PNG or offline image
          return new Response(
            '<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" fill="transparent"/></svg>',
            {
              headers: { 'Content-Type': 'image/svg+xml' },
              status: 200
            }
          );
        }

        // For other requests, return appropriate error response
        return new Response(
          JSON.stringify({
            error: 'Offline - Resource not available',
            message: 'This resource is not available offline. Please check your connection.'
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          }
        );
      })
  );
});

// ==============================================================================
// ADDITIONAL SERVICE WORKER FEATURES
// ==============================================================================

/**
 * MESSAGE HANDLING
 *
 * Handle messages from the main application for cache management
 * Example: Clear cache, force refresh, etc.
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      // Force the service worker to become active
      self.skipWaiting();
      break;

    case 'CACHE_CLEAR':
      // Clear all caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;

    case 'CACHE_UPDATE':
      // Update specific cache entries
      if (payload && payload.urls) {
        caches.open(CACHE_NAME)
          .then((cache) => cache.addAll(payload.urls))
          .then(() => {
            event.ports[0].postMessage({ success: true });
          })
          .catch((error) => {
            event.ports[0].postMessage({ success: false, error: error.message });
          });
      }
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

/**
 * SYNC EVENT (Background Sync)
 *
 * Handle background synchronization for offline actions
 * Useful for syncing data when connection is restored
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(
      // Implement background sync logic here
      // Example: Sync pending form submissions, cache updates, etc.
      Promise.resolve()
    );
  }
});

/**
 * PUSH NOTIFICATIONS (Optional)
 *
 * Handle push notifications for user engagement
 * Uncomment and implement if push notifications are needed
 */
/*
self.addEventListener('push', (event) => {
  const options = {
    body: event.data.text(),
    icon: '/linux-icon.svg',
    badge: '/linux-icon.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Linux Tutorial CMS', options)
  );
});
*/

// ==============================================================================
// DEBUGGING AND MONITORING
// ==============================================================================

/**
 * Error handling and logging for debugging
 * Consider implementing analytics or error reporting
 */
self.addEventListener('error', (event) => {
  console.error('[SW] Service Worker error:', event.error);
  // Optionally send error reports to analytics service
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
  // Optionally handle unhandled promise rejections
});

console.log('[SW] Service Worker loaded successfully');
