import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  private isChunkLoadError(error: Error | null): boolean {
    if (!error) return false;
    const msg = String(error.message || '');
    return (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Expected a JavaScript-or-Wasm module script') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('dynamically imported module')
    );
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Erreur interceptée:', error.message);
    console.error('[ErrorBoundary] Composant fautif:', errorInfo.componentStack?.split('\n')?.[1]?.trim());

    // Si c'est une erreur de chunk liée à un nouveau déploiement, on tente un rechargement automatique
    if (this.isChunkLoadError(error)) {
      const sessionKey = 'dmk_chunk_retry_timestamp';
      const lastRetry = sessionStorage.getItem(sessionKey);
      const now = Date.now();
      if (!lastRetry || now - Number(lastRetry) > 10000) {
        sessionStorage.setItem(sessionKey, String(now));
        console.warn('[ErrorBoundary] Chunk obsolète détecté, rechargement automatique...');
        window.location.reload();
      }
    }
  }

  // Reset automatique lors d'un changement de contenu enfant (navigation)
  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  private handleBack = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.history.back();
  };

  private handleRetry = () => {
    if (this.isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      const isDeploymentError = this.isChunkLoadError(this.state.error);

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 font-sans">
          <div className="max-w-sm w-full bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center shadow-xl space-y-5">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-500">
              <AlertTriangle size={28} />
            </div>
            
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-slate-800 dark:text-white">
                {isDeploymentError ? 'Mise à jour disponible' : 'Affichage temporairement interrompu'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isDeploymentError
                  ? 'Une nouvelle version de DMK Système a été déployée. Cliquez ci-dessous pour actualiser et continuer.'
                  : 'Cette section a rencontré une erreur. Les autres pages de l\'application fonctionnent normalement.'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleRetry}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-900/20 cursor-pointer"
              >
                <RefreshCw size={16} />
                {isDeploymentError ? 'Actualiser l\'application' : 'Réessayer'}
              </button>
              <button
                onClick={this.handleBack}
                className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-[0.99] rounded-xl text-slate-700 dark:text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft size={16} />
                Retour
              </button>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details className="text-left mt-2">
                <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                  Détails techniques (dev)
                </summary>
                <pre className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
