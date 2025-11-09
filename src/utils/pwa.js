// Global variable to store the install prompt event
let deferredPrompt = null;
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
export const isPWAInstalled = () => {
  return window.matchMedia('(display-mode: standalone)').matches;
};