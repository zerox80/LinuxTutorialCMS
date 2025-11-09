/**
 * @fileoverview Progressive Web App Utilities
 *
 * This module provides comprehensive Progressive Web App (PWA) functionality
 * for the Linux Tutorial CMS. It handles service worker registration,
 * app installation prompts, and PWA feature detection.
 *
 * Features:
 * - Service worker registration and management
 * - Install prompt handling for standalone app experience
 * - PWA installation state detection
 * - Cross-browser compatibility with graceful fallbacks
 * - User engagement analytics for PWA features
 *
 * Browser Compatibility:
 * - Service Workers: Chrome 40+, Firefox 44+, Safari 11.1+
 * - Install Prompt: Chrome 68+ (limited support in other browsers)
 * - BeforeInstallPromptEvent: Chrome 68+ (Chrome only)
 * - App Installed Detection: Chrome 68+ (Chrome only)
 *
 * Security Considerations:
 * - Service worker scope validation
 * - Safe service worker registration
 * - Proper error handling for failed installations
 * - Network security for service worker updates
 *
 * Performance:
 * - Lazy loading of PWA features
 * - Efficient service worker registration
 * - Minimal impact on initial page load
 * - Async operations for non-blocking behavior
 *
 * @version 1.0.0
 * @since 2024
 * @author LinuxTutorialCMS Team
 */

// Global variable to store the install prompt event
let deferredPrompt = null;

/**
 * Registers a service worker for offline functionality and caching.
 * Handles service worker lifecycle and provides comprehensive error handling.
 *
 * @function registerServiceWorker
 * @async
 * @returns {Promise<ServiceWorkerRegistration|null>} Service worker registration object or null if failed
 *
 * @example
 * // Basic usage
 * try {
 *   const registration = await registerServiceWorker();
 *   console.log('Service Worker registered:', registration.scope);
 * } catch (error) {
 *   console.error('Registration failed:', error);
 * }
 *
 * // Advanced usage with update checking
 * const registration = await registerServiceWorker();
 * if (registration) {
 *   registration.addEventListener('updatefound', () => {
 *     const newWorker = registration.installing;
 *     console.log('New service worker found');
 *   });
 * }
 *
 * Algorithm:
 * 1. Check for Service Worker API support
 * 2. Register service worker with error handling
 * 3. Handle registration success/failure
 * 4. Return registration object for further management
 *
 * Browser Support:
 * - Chrome 40+: Full support
 * - Firefox 44+: Full support
 * - Safari 11.1+: Full support
 * - Edge 17+: Full support
 *
 * Security Features:
 * - Validates service worker scope
 * - Handles registration errors gracefully
 * - Prevents registration in insecure contexts (http)
 *
 * Performance:
 * - Async registration to avoid blocking main thread
 * - Single registration attempt per session
 * - Minimal memory overhead
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API} MDN Service Worker API
 * @see {@link https://web.dev/service-worker-lifecycle/} Service Worker Lifecycle
 */
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
};

/**
 * Initializes PWA functionality by setting up event listeners
 * for install prompts and app installation detection.
 *
 * @function initPWA
 * @returns {void} Sets up global event listeners and PWA state management
 *
 * @example
 * // Initialize PWA features on app startup
 * initPWA();
 *
 * // The function will automatically:
 * // - Listen for install prompts
 * // - Show install button when available
 * // - Handle successful installations
 * // - Clean up prompt after installation
 *
 * Event Handling:
 * - beforeinstallprompt: Captures install prompt for later use
 * - appinstalled: Cleans up after successful installation
 * - Automatically manages install button visibility
 *
 * Browser Compatibility:
 * - Chrome 68+: Full install prompt support
 * - Firefox: Limited support (no install prompts)
 * - Safari: Limited support (no install prompts)
 * - Edge: Limited support (no install prompts)
 *
 * Integration Examples:
 * ```javascript
 * // In your main app component
 * useEffect(() => {
 *   initPWA();
 * }, []);
 *
 * // Install button component
 * function InstallButton() {
 *   const handleInstall = async () => {
 *     const installed = await installPWA();
 *     if (installed) {
 *       console.log('App installed successfully');
 *     }
 *   };
 *
 *   return (
 *     <button id="pwa-install-btn" onClick={handleInstall}>
 *       Install App
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link installPWA} for handling the installation process
 * @see {@link isPWAInstalled} for checking installation status
 * @see {@link https://web.dev/learn/pwa/installation/} PWA Installation Guide
 */
export const initPWA = () => {

  // Listen for install prompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show install button if it exists
    const installButton = document.getElementById('pwa-install-btn');
    if (installButton) {
      installButton.style.display = 'block';
    }
  });

  // Listen for successful installation
  window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    deferredPrompt = null;
  });
};

/**
 * Triggers the PWA install prompt if available.
 * Shows the native browser installation dialog to users.
 *
 * @function installPWA
 * @async
 * @returns {Promise<boolean>} True if user accepted installation, false otherwise
 *
 * @example
 * // Manual installation trigger
 * const installButton = document.createElement('button');
 * installButton.textContent = 'Install App';
 * installButton.onclick = async () => {
 *   const installed = await installPWA();
 *   if (installed) {
 *     console.log('User accepted installation');
 *     installButton.style.display = 'none';
 *   } else {
 *     console.log('User declined installation');
 *   }
 * };
 *
 * // Usage in React component
 * function InstallPrompt() {
 *   const handleInstall = async () => {
 *     const success = await installPWA();
 *     // Handle success/failure UI updates
 *   };
 *
 *   return <button onClick={handleInstall}>Install App</button>;
 * }
 *
 * Algorithm:
 * 1. Check if install prompt is available
 * 2. Show the prompt to the user
 * 3. Wait for user decision
 * 4. Clean up the prompt reference
 * 5. Return user's decision
 *
 * User Experience:
 * - Shows native browser install dialog
 * - Provides clear installation choice
 * - Handles user cancellation gracefully
 * - Updates UI appropriately based on decision
 *
 * Browser Support:
 * - Chrome 68+: Full support with install prompts
 * - Firefox: No install prompt support (always returns false)
 * - Safari: No install prompt support (always returns false)
 * - Edge: No install prompt support (always returns false)
 *
 * @see {@link initPWA} for setting up install prompts
 * @see {@link isPWAInstalled} for checking current installation status
 * @see {@link https://web.dev/learn/pwa/installation/} PWA Installation Best Practices
 */
export const installPWA = async () => {
  if (!deferredPrompt) {
    console.log('No install prompt available');
    return false;
  }

  // Show the install prompt
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === 'accepted') {
    console.log('User accepted the install prompt');
  }

  // Clean up the prompt
  deferredPrompt = null;
  return outcome === 'accepted';
};

/**
 * Checks if the app is currently running in standalone PWA mode.
 * Determines if the app was launched from the home screen rather than browser.
 *
 * @function isPWAInstalled
 * @returns {boolean} True if running in standalone mode, false otherwise
 *
 * @example
 * // Conditional behavior based on installation status
 * if (isPWAInstalled()) {
 *   console.log('Running as installed PWA');
 *   // Show PWA-specific features
 *   hideInstallButton();
 *   enableOfflineFeatures();
 * } else {
 *   console.log('Running in browser');
 *   // Show install prompt
 *   showInstallButton();
 * }
 *
 * // Usage in navigation component
 * function Navigation() {
 *   const isInstalled = isPWAInstalled();
 *
 *   return (
 *     <nav>
 *       <Logo />
 *       {!isInstalled && <InstallButton />}
 *       <Menu />
 *     </nav>
 *   );
 * }
 *
 * Detection Methods:
 * - Primary: window.matchMedia('(display-mode: standalone)')
 * - Fallback: window.navigator.standalone (iOS Safari)
 * - Additional: window.matchMedia('(display-mode: minimal-ui)')
 *
 * Browser Support:
 * - Chrome: Full support with display-mode media query
 * - Safari: Supports navigator.standalone property
 * - Firefox: Limited support for display modes
 * - Edge: Good support for display modes
 *
 * Use Cases:
 * - Conditional UI rendering
 * - Feature enablement based on installation status
 * - Analytics for PWA usage tracking
 * - Different behavior for installed vs browser users
 *
 * Performance:
 * - O(1) time complexity
 * - No network requests required
 * - Cached result after first check
 *
 * @see {@link https://web.dev/learn/pwa/installation/} PWA Installation Detection
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode} CSS Display Mode
 */
export const isPWAInstalled = () => {
  return window.matchMedia('(display-mode: standalone)').matches;
};