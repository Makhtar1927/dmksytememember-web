import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MemberLayout } from './layouts/MemberLayout';

// Code splitting / Lazy loading des pages pour des performances maximales
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Events = lazy(() => import('./pages/Events'));
const Profil = lazy(() => import('./pages/Profil'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Bureau = lazy(() => import('./pages/Bureau'));
const Secteur = lazy(() => import('./pages/Secteur'));
const Cotiser = lazy(() => import('./pages/Cotiser'));
const Tresorerie = lazy(() => import('./pages/Tresorerie'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Statistiques = lazy(() => import('./pages/Statistiques'));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
      <p className="text-xs font-medium text-slate-500 tracking-wide uppercase">Chargement...</p>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route element={<ProtectedRoute />}>
              <Route element={<MemberLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/profil" element={<Profil />} />
                <Route path="/events" element={<Events />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/bureau" element={<Bureau />} />
                <Route path="/secteur" element={<Secteur />} />
                <Route path="/cotiser" element={<Cotiser />} />
                <Route path="/finances" element={<Tresorerie />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/stats" element={<Statistiques />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
