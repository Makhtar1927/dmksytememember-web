import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MemberLayout } from './layouts/MemberLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

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

// Wrapper qui combine ErrorBoundary + Suspense pour chaque page
function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
          <Route path="/register" element={<PageWrapper><Register /></PageWrapper>} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<MemberLayout />}>
              <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
              <Route path="/profil" element={<PageWrapper><Profil /></PageWrapper>} />
              <Route path="/events" element={<PageWrapper><Events /></PageWrapper>} />
              <Route path="/notifications" element={<PageWrapper><Notifications /></PageWrapper>} />
              <Route path="/bureau" element={<PageWrapper><Bureau /></PageWrapper>} />
              <Route path="/secteur" element={<PageWrapper><Secteur /></PageWrapper>} />
              <Route path="/cotiser" element={<PageWrapper><Cotiser /></PageWrapper>} />
              <Route path="/finances" element={<PageWrapper><Tresorerie /></PageWrapper>} />
              <Route path="/transactions" element={<PageWrapper><Transactions /></PageWrapper>} />
              <Route path="/stats" element={<PageWrapper><Statistiques /></PageWrapper>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
