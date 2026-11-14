import { useState, useEffect } from 'react';
import { Download, X, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const STORAGE_KEY = 'dmk_pwa_install_dismissed';

/** Détection Safari sur iOS (iPhone/iPad) */
const isIOS = () => {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

/** Vérifie si l'application est déjà lancée en mode autonome (PWA installée) */
const isRunningStandalone = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
};

export default function InstallAppPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSPlatform, setIsIOSPlatform] = useState(false);

  useEffect(() => {
    // Si déjà installée et ouverte en mode application standalone, on n'affiche rien
    if (isRunningStandalone()) return;

    // Vérifier si l'utilisateur a refusé ou fermé récemment (ex: moins de 7 jours)
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt) {
      const diffDays = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (diffDays < 7) {
        return;
      }
    }

    const ios = isIOS();
    setIsIOSPlatform(ios);

    // Écouter l'événement standard PWA pour Chrome, Android, Edge, etc.
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setIsVisible(true), 1200);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Sur iOS Safari, beforeinstallprompt n'est pas supporté : on déclenche après un court délai
    if (ios) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    // Écouter si l'application est installée avec succès
    const handleAppInstalled = () => {
      setIsVisible(false);
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      } else {
        setIsVisible(false);
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn("Erreur d'installation PWA:", err);
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      
      {/* Click outside to dismiss */}
      <div 
        className="fixed inset-0 z-0" 
        onClick={handleDismiss} 
        aria-label="Fermer"
      />

      <div className="relative z-10 w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-[32px] sm:rounded-[32px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800/80 p-5 sm:p-7 pb-8 sm:pb-7 shadow-[0_-12px_40px_rgba(0,0,0,0.2)] sm:shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
        
        {/* Glow decoration */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#1DC4E9]/20 dark:bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header avec logo, titre et bouton fermer */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3.5">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1DC4E9] to-blue-600 p-0.5 shadow-lg shadow-[#1DC4E9]/25">
              <div className="h-full w-full rounded-[14px] bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                <img 
                  src="/dmk-icon.png" 
                  alt="DMK Logo" 
                  className="h-10 w-10 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-widest uppercase text-[#1DC4E9] dark:text-[#1DC4E9]">
                Application Officielle
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                {isIOSPlatform ? "Installer sur iPhone" : "Installer DMK Système"}
              </h3>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="rounded-full bg-slate-100 dark:bg-slate-800/80 p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            aria-label="Fermer"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium mb-5 leading-relaxed">
          Ajoutez l'application sur votre écran d'accueil pour accéder instantanément à vos cotisations et à votre carte membre, avec une fluidité optimale.
        </p>

        {/* Contenu spécifique iOS / Safari */}
        {isIOSPlatform ? (
          <div className="space-y-4 mb-6">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-black text-xs">
                  1
                </div>
                <div className="flex-1 text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-semibold">
                  Appuyez sur le bouton{' '}
                  <span className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md">
                    <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    Partager
                  </span>{' '}
                  en bas de Safari.
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-black text-xs">
                  2
                </div>
                <div className="flex-1 text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-semibold">
                  Faites défiler et choisissez{' '}
                  <span className="inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white bg-slate-200/70 dark:bg-slate-700/70 px-1.5 py-0.5 rounded-md">
                    <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="4" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Sur l'écran d'accueil
                  </span>.
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-black text-xs">
                  3
                </div>
                <div className="flex-1 text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-semibold">
                  Appuyez sur <strong className="text-blue-600 dark:text-blue-400 font-bold">« Ajouter »</strong> en haut à droite.
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleDismiss}
                className="flex-1 rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-3.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95"
              >
                Plus tard
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1DC4E9] to-blue-600 hover:from-[#18A2C2] hover:to-blue-700 px-4 py-3.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-[#1DC4E9]/25 transition-all active:scale-95"
              >
                <Check size={16} />
                J'ai compris
              </button>
            </div>
          </div>
        ) : (
          /* Contenu standard Android / Chrome / Edge */
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleDismiss}
              className="flex-1 rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-3.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95"
            >
              Plus tard
            </button>
            <button
              onClick={handleInstallClick}
              disabled={!deferredPrompt}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1DC4E9] to-blue-600 hover:from-[#18A2C2] hover:to-blue-700 px-4 py-3.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-[#1DC4E9]/25 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 group"
            >
              <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
              Installer
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
