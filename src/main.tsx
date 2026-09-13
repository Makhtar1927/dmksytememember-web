import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initCapacitorNative } from './utils/capacitorNative'
import { ErrorBoundary } from './components/ErrorBoundary'

// Protection contre les crashs React causés par Google Translate / extensions
// Empêche l'erreur fatale : "Failed to execute 'insertBefore' on 'Node'"
if (typeof Node === 'function' && Node.prototype) {
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn('[DOM Shield] insertBefore protégé contre la modification par Google Translate');
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      console.warn('[DOM Shield] removeChild protégé contre la modification par Google Translate');
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };
}

// Initialisation des fonctionnalités natives mobiles (Capacitor)
initCapacitorNative();

// Enregistrement du Service Worker PWA pour les notifications mobiles et arrière-plan
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (import.meta.env.DEV) {
        console.log('[PWA] Service Worker enregistré avec succès:', reg.scope);
      }
    }).catch((err) => {
      console.warn('[PWA] Échec enregistrement Service Worker:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
