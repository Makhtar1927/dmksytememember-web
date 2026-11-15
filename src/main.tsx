import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initCapacitorNative } from './utils/capacitorNative'
import { ErrorBoundary } from './components/ErrorBoundary'

// ─────────────────────────────────────────────────────────────
// DOM SHIELD v2 — Protection robuste contre les crashs React
// Cause : Google Translate / extensions mutent le DOM pendant
//         que React effectue sa réconciliation (insertBefore).
//
// Stratégie : on intercepte TOUTES les erreurs DOM de ce type
//             et on les avale silencieusement au lieu de laisser
//             React propager un crash qui vide l'écran.
// ─────────────────────────────────────────────────────────────
if (typeof Node === 'function' && Node.prototype) {
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
    // Si le nœud de référence n'appartient plus à ce parent (DOM muté
    // par une extension externe), on tente quand même l'insertion et
    // on absorbe l'erreur plutôt que de laisser React crasher.
    if (refNode && refNode.parentNode !== this) {
      try {
        return originalInsertBefore.call(this, newNode, null) as T; // append en fin de liste
      } catch {
        console.warn('[DOM Shield] insertBefore absorbé (nœud orphelin)');
        return newNode;
      }
    }
    try {
      return originalInsertBefore.call(this, newNode, refNode) as T;
    } catch {
      console.warn('[DOM Shield] insertBefore absorbé (erreur inattendue)');
      return newNode;
    }
  };

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      console.warn('[DOM Shield] removeChild absorbé (nœud orphelin)');
      return child;
    }
    try {
      return originalRemoveChild.call(this, child) as T;
    } catch {
      console.warn('[DOM Shield] removeChild absorbé (erreur inattendue)');
      return child;
    }
  };
}

// Initialisation des fonctionnalités natives mobiles (Capacitor)
initCapacitorNative();

// ─────────────────────────────────────────────────────────────
// AUTO-RECOVERY : Récupération automatique lors d'un nouveau déploiement
// Vite déclenche vite:preloadError si un chunk n'existe plus sur le CDN.
// ─────────────────────────────────────────────────────────────
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const sessionKey = 'dmk_vite_preload_error_ts';
  const lastError = sessionStorage.getItem(sessionKey);
  const now = Date.now();
  if (!lastError || now - Number(lastError) > 10000) {
    sessionStorage.setItem(sessionKey, String(now));
    console.warn('[Vite Preload] Nouveau déploiement détecté, rechargement immédiat...');
    window.location.reload();
  }
});

// Enregistrement du Service Worker PWA
if ('serviceWorker' in navigator) {
  // Détecter quand un nouveau Service Worker est activé pour rafraîchir proprement
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] Nouveau Service Worker activé, actualisation...');
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (import.meta.env.DEV) {
        console.log('[PWA] Service Worker enregistré:', reg.scope);
      }
      // Vérifier immédiatement si une nouvelle version existe
      reg.update().catch(() => {});
    }).catch((err) => {
      console.warn('[PWA] Échec enregistrement Service Worker:', err);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// NOTE : StrictMode RETIRÉ intentionnellement en production.
// StrictMode force un double-render qui peut désynchroniser
// l'arbre React/DOM et déclencher des insertBefore invalides.
// Il reste actif dans le dev server si nécessaire.
// ─────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
