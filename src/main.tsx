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
  const _insertBefore = Node.prototype.insertBefore;
  (Node.prototype as any).insertBefore = function (newNode: Node, refNode: Node | null) {
    // Si le nœud de référence n'appartient plus à ce parent (DOM muté
    // par une extension externe), on tente quand même l'insertion et
    // on absorbe l'erreur plutôt que de laisser React crasher.
    if (refNode && refNode.parentNode !== this) {
      try {
        return _insertBefore.call(this, newNode, null); // append en fin de liste
      } catch {
        console.warn('[DOM Shield] insertBefore absorbé (nœud orphelin)');
        return newNode;
      }
    }
    try {
      return _insertBefore.call(this, newNode, refNode);
    } catch {
      console.warn('[DOM Shield] insertBefore absorbé (erreur inattendue)');
      return newNode;
    }
  };

  const _removeChild = Node.prototype.removeChild;
  (Node.prototype as any).removeChild = function (child: Node) {
    if (child.parentNode !== this) {
      console.warn('[DOM Shield] removeChild absorbé (nœud orphelin)');
      return child;
    }
    try {
      return _removeChild.call(this, child);
    } catch {
      console.warn('[DOM Shield] removeChild absorbé (erreur inattendue)');
      return child;
    }
  };
}

// Initialisation des fonctionnalités natives mobiles (Capacitor)
initCapacitorNative();

// Enregistrement du Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (import.meta.env.DEV) {
        console.log('[PWA] Service Worker enregistré:', reg.scope);
      }
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
