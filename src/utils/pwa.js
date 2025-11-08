// PWA Registration and Installation

/**
 * Registers the service worker for the PWA.
 * @returns {Promise<ServiceWorkerRegistration|undefined>} A promise that resolves with the service worker registration object, or undefined if registration fails.
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

let deferredPrompt = null;

/**
 * Initializes the PWA installation flow by listening for the `beforeinstallprompt` event.
 * When the event is fired, it captures the prompt and makes it available for later use.
 */
export const initPWA = () => {
  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show install button
    const installButton = document.getElementById('pwa-install-btn');
    if (installButton) {
      installButton.style.display = 'block';
    }
  });

  // Listen for app installed event
  window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    deferredPrompt = null;
  });
};

/**
 * Triggers the PWA installation prompt.
 * @returns {Promise<boolean>} A promise that resolves to true if the user accepts the prompt, otherwise false.
 */
export const installPWA = async () => {
  if (!deferredPrompt) {
    console.log('No install prompt available');
    return false;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    console.log('User accepted the install prompt');
  }
  
  deferredPrompt = null;
  return outcome === 'accepted';
};

/**
 * Checks if the PWA is currently running in standalone mode (i.e., installed).
 * @returns {boolean} True if the PWA is installed, otherwise false.
 */
export const isPWAInstalled = () => {
  return window.matchMedia('(display-mode: standalone)').matches;
};
