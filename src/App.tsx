import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MemberLayout } from './layouts/MemberLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Profil from './pages/Profil';
import Notifications from './pages/Notifications';
import Bureau from './pages/Bureau';
import Secteur from './pages/Secteur';
import Tresorerie from './pages/Tresorerie';
import Statistiques from './pages/Statistiques';
import Cotiser from './pages/Cotiser';
import Transactions from './pages/Transactions';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
