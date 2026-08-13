import type { FC } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, LogOut } from 'lucide-react';

export const ProtectedRoute: FC = () => {
  const { user, memberStatus, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (memberStatus === 'Inactif' || memberStatus === 'En attente') {
    const isPending = memberStatus === 'En attente';
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-2xl">
          <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${isPending ? 'bg-amber-50 text-amber-500 dark:bg-amber-900/20' : 'bg-red-50 text-red-500 dark:bg-red-900/20'}`}>
            <ShieldAlert size={40} />
          </div>
          <h2 className="mb-2 text-2xl font-black text-slate-900 dark:text-white">
            {isPending ? "Compte en attente d'activation" : "Compte Suspendu"}
          </h2>
          <p className="mb-8 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            {isPending 
              ? "Votre inscription a bien été enregistrée. Votre compte est actuellement en attente de validation par l'administrateur DMK."
              : "Votre compte est actuellement inactif. Veuillez contacter un administrateur pour réactiver votre compte."}
          </p>
          <button
            onClick={async () => {
              await signOut();
            }}
            className="flex w-full items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-4 text-center text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <LogOut size={18} className="mr-2" />
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};
