var CACHE_NAME = 'pwa-lonewolf-messenger';

import { precacheAndRoute } from 'workbox-precaching';

console.log('Service Worker Initialization');

// Gestione del precaching
try {
  if (self.__WB_MANIFEST) {
    precacheAndRoute(self.__WB_MANIFEST);
    console.log('Precaching completato con successo');
  } else {
    console.log('Nessun manifest di precaching trovato');
  }
} catch (error) {
  console.error('Errore durante il precaching:', error);
}

var urlsToCache = ['/'];

// Install a service worker
self.addEventListener('install', (event) => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log('Cache aperta');
      return cache.addAll(urlsToCache);
    })
  );
});

// Cache and return requests
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      // Cache hit - return response
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});

// Update a service worker
self.addEventListener('activate', (event) => {
  var cacheWhitelist = ['pwa-lonewolf-messenger'];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
