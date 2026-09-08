/**
 * Résolution propre et sécurisée de l'URL du backend Render.
 * Intercepte et corrige automatiquement l'ancienne URL sans `-dfjz`
 * même si elle est définie dans les variables d'environnement Vercel.
 */
export const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;

  // Si on est en local et pas d'URL spécifique définie
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    if (!envUrl || envUrl.includes('localhost')) {
      return 'http://localhost:5000';
    }
  }

  // Si l'URL Vercel contient l'ancien backend ou est vide
  if (!envUrl || envUrl.includes('dmksytemebackend.onrender.com')) {
    return 'https://dmksytemebackend-dfjz.onrender.com';
  }

  return envUrl;
};
