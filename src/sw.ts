/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Supprimer automatiquement tous les anciens caches des déploiements précédents
cleanupOutdatedCaches();

// Ce tableau sera injecté automatiquement par vite-plugin-pwa au moment du build
precacheAndRoute(self.__WB_MANIFEST || []);

// Nettoyer les anciens caches et prendre le contrôle immédiat
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (!name.includes('workbox-precache')) {
              return caches.delete(name);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

// Navigation : Network-First pour garantir que Safari charge toujours le dernier HTML avec les bons hash CSS
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/index.html');
        if (cached) return cached;
        return new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
    );
  }
});

// Écoute des Web Push Notifications
self.addEventListener('push', function (event: any) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'DMK Alerte';
    
    // Utiliser any pour contourner la stricte validation TS sur "vibrate"
    const options: any = {
      body: data.body || 'Vous avez un nouveau message.',
      icon: '/dmk-icon.png',
      badge: '/dmk-icon.png',
      vibrate: [200, 100, 200, 100, 200],
      data: data.data || {},
      requireInteraction: true
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error("Erreur parsing Web Push payload:", error);
    
    const fallbackOptions: any = {
      body: event.data.text(),
      icon: '/dmk-icon.png',
      vibrate: [200, 100, 200],
      requireInteraction: true
    };
    
    event.waitUntil(
      self.registration.showNotification('DMK', fallbackOptions)
    );
  }
});

// Gérer le clic sur la notification
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  // Ouvre l'application si elle n'est pas déjà ouverte
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windowClients) => {
      // S'il y a déjà une fenêtre ouverte, on la focus
      if (windowClients.length > 0) {
        return windowClients[0].focus();
      }
      // Sinon on ouvre une nouvelle fenêtre (ici la racine de l'app)
      return self.clients.openWindow('/');
    })
  );
});
