import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initCapacitorNative } from './utils/capacitorNative'

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
    <App />
  </StrictMode>,
)

