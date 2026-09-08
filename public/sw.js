// Service Worker PWA DMK - Gestion des Push Notifications et cycle de vie
const CACHE_NAME = 'dmk-pwa-cache-v1';

self.addEventListener('install', (event) => {
  // Activation immédiate sans attendre la fermeture des autres onglets
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Écoute des Web Push Notifications (quand l'écran est éteint ou le navigateur fermé)
self.addEventListener('push', (event) => {
  let data = {
    title: 'Alerte DMK 🔔',
    body: 'Vous avez reçu une nouvelle information du Dahira.',
    icon: '/dmk-icon.png',
    badge: '/dmk-icon.png',
    data: {}
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data.title = parsed.title || data.title;
      data.body = parsed.body || data.body;
      if (parsed.data) data.data = parsed.data;
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const isTreasury = data.data && data.data.channelId === 'dmk_treasury';

  const options = {
    body: data.body,
    icon: '/dmk-icon.png',
    badge: '/dmk-icon.png',
    vibrate: isTreasury ? [0, 500, 200, 800, 200, 1000] : [200, 100, 200, 100, 200],
    data: data.data,
    requireInteraction: true,
    tag: data.data && data.data.id ? String(data.data.id) : undefined,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Focus sur la fenêtre existante ou en ouvrir une nouvelle
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
