import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initCapacitorNative } from './utils/capacitorNative'

// Initialisation des fonctionnalités natives mobiles (Capacitor)
initCapacitorNative();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

