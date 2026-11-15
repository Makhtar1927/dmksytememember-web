import { lazy, type ComponentType } from 'react';

/**
 * Chargeur de composant dynamique ultra-résilient aux nouveaux déploiements.
 * Si un nouveau déploiement Vercel remplace les chunks JS sur le serveur
 * et qu'un utilisateur possède un ancien onglet ouvert, cette fonction intercepte
 * l'erreur "Failed to fetch dynamically imported module" et recharge automatiquement
 * la page vers la dernière version sans bloquer l'interface.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const sessionKey = 'dmk_chunk_retry_timestamp';
    try {
      const component = await factory();
      // Succès : on nettoie l'éventuel timestamp de retry
      sessionStorage.removeItem(sessionKey);
      return component;
    } catch (error: any) {
      const errorMsg = String(error?.message || error || '');
      const isChunkError =
        errorMsg.includes('Failed to fetch dynamically imported module') ||
        errorMsg.includes('Expected a JavaScript-or-Wasm module script') ||
        errorMsg.includes('error loading dynamically imported module') ||
        errorMsg.includes('Importing a module script failed') ||
        errorMsg.includes('dynamically imported module');

      if (isChunkError) {
        const lastRetry = sessionStorage.getItem(sessionKey);
        const now = Date.now();
        
        // Empêche toute boucle infinie : max 1 rechargement toutes les 10 secondes
        if (!lastRetry || now - Number(lastRetry) > 10000) {
          sessionStorage.setItem(sessionKey, String(now));
          console.warn('[Deployment Recovery] Version obsolète détectée. Rechargement propre vers la nouvelle version...');
          
          // Purger les caches Workbox éventuels avant reload
          if ('caches' in window) {
            try {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            } catch {
              // Ignore cache delete errors
            }
          }
          
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });
}
