import { type FC, useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Home, Calendar, Bell, Map, DollarSign, TrendingUp, Wallet, Moon, Sun, ListChecks, User, LogOut, IdCard } from 'lucide-react';
import { NotificationProvider } from '../lib/NotificationContext';
import { useNotifications } from '../lib/useNotifications';
import { supabase } from '../lib/supabase';
import MemberCardModal from '../components/MemberCardModal';


const LayoutContent: FC = () => {
  const { userRole } = useAuth();
  const { unreadCount } = useNotifications();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return savedTheme === 'dark' || (!savedTheme && prefersDark);
  });
  const [isCardOpen, setIsCardOpen] = useState(false);

  // Apply theme class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const newTheme = !prev;
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const roleStr = (userRole || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  const showSecteur = ['dieuwrigne darou', 'dieuwrigne de darou'].includes(roleStr);
  const showFinances = ['tresorier', 'tresoriere', 'tresorier general', 'tresoriere generale'].includes(roleStr);
  const showStats = [
    'presidence (dg/sg)',
    'dieuwrigne',
    'vice-dieuwrigne',
    'vice dieuwrigne',
    'secretaire general',
    'secretaire generale',
    'commissaire au compte',
  ].includes(roleStr);

  const tabs = [
    { name: 'Accueil', to: '/', icon: Home, show: true },
    { name: 'Événements', to: '/events', icon: Calendar, show: true },
    { name: 'Secteur', to: '/secteur', icon: Map, show: showSecteur },
    { name: 'Cotiser', to: '/cotiser', icon: Wallet, show: true },
    { name: 'Finances', to: '/finances', icon: DollarSign, show: showFinances },
    { name: 'Transactions', to: '/transactions', icon: ListChecks, show: showFinances },
    { name: 'Stats', to: '/stats', icon: TrendingUp, show: showStats },
  ];

  const visibleTabs = tabs.filter((tab) => tab.show);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-500 flex-col md:flex-row overflow-hidden relative">
      
      {/* Animated Background Bubbles (Glassmorphism Core) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-400/30 dark:bg-blue-600/10 blur-[120px] animate-pulse anim-duration-8s" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-cyan-400/20 dark:bg-cyan-800/20 blur-[150px] animate-pulse anim-duration-10s" />
        <div className="absolute top-[30%] left-[20%] w-[50%] h-[50%] rounded-full bg-indigo-400/20 dark:bg-indigo-900/20 blur-[100px] animate-pulse anim-duration-12s" />
      </div>

      {/* Mobile Header with Theme Toggle */}
      <div className="md:hidden relative z-40 flex items-center justify-between px-6 py-4 bg-white/60 dark:bg-slate-900/50 border-b border-white/40 dark:border-slate-800/50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 overflow-hidden rounded-lg shadow-sm">
            <img src="/icon.png" alt="Logo" className="h-full w-full object-cover" onError={(e) => e.currentTarget.style.display='none'} />
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">DMK</h1>
        </div>
        <div className="flex items-center gap-2">
          <NavLink
            to="/profil"
            className={({ isActive }) =>
              `relative p-2.5 rounded-full border transition-transform active:scale-95 ${
                isActive 
                  ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400'
                  : 'bg-white/50 dark:bg-slate-800/50 border-white/40 dark:border-slate-700/50 text-slate-700 dark:text-slate-300'
              }`
            }
          >
            <User size={20} />
          </NavLink>
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `relative p-2.5 rounded-full border transition-transform active:scale-95 ${
                isActive 
                  ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400'
                  : 'bg-white/50 dark:bg-slate-800/50 border-white/40 dark:border-slate-700/50 text-slate-700 dark:text-slate-300'
              }`
            }
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                {unreadCount}
              </span>
            )}
          </NavLink>
          <button 
            onClick={toggleTheme} 
            className="p-2.5 rounded-full bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 transition-transform active:scale-95"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={handleSignOut} 
            className="p-2.5 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 transition-transform active:scale-95 hover:bg-red-100 dark:hover:bg-red-500/20"
            title="Se déconnecter"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex relative z-40 w-64 flex-col bg-white/60 dark:bg-slate-900/50 border-r border-white/40 dark:border-slate-800/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
        <div className="flex h-20 items-center justify-center px-6 border-b border-white/40 dark:border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-xl shadow-sm border border-white/50 bg-white/20">
              <img src="/icon.png" alt="Logo" className="h-full w-full object-contain" onError={(e) => e.currentTarget.style.display='none'} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">DMK</h1>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 custom-scrollbar">
          <ul className="space-y-2 px-4">
            {visibleTabs.map((tab) => (
              <li key={tab.name}>
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 relative ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 dark:shadow-blue-900/40 translate-x-1'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white hover:translate-x-1'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <tab.icon className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${isActive ? 'text-white' : ''}`} />
                      {tab.name}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* User Actions Footer */}
        <div className="p-6 border-t border-white/40 dark:border-slate-800/50 flex flex-wrap justify-center gap-3">
          <NavLink
            to="/profil"
            className={({ isActive }) =>
              `relative p-3 rounded-full border transition-transform hover:scale-110 ${
                isActive 
                  ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400'
                  : 'bg-white/50 dark:bg-slate-800/50 border-white/40 dark:border-slate-700/50 text-slate-700 dark:text-slate-300'
              }`
            }
            title="Profil"
          >
            <User size={20} />
          </NavLink>
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `relative p-3 rounded-full border transition-transform hover:scale-110 ${
                isActive 
                  ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400'
                  : 'bg-white/50 dark:bg-slate-800/50 border-white/40 dark:border-slate-700/50 text-slate-700 dark:text-slate-300'
              }`
            }
            title="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                {unreadCount}
              </span>
            )}
          </NavLink>
          <button 
            onClick={toggleTheme} 
            className="p-3 rounded-full bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 transition-transform hover:scale-110"
            title="Thème"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={handleSignOut} 
            className="p-3 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 transition-transform hover:scale-110 hover:bg-red-100 dark:hover:bg-red-500/20"
            title="Se déconnecter"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-44 md:pb-12 scroll-smooth">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/70 dark:bg-slate-900/80 backdrop-blur-2xl border-t border-white/40 dark:border-slate-800/50 pb-safe shadow-[0_-8px_32px_rgba(0,0,0,0.05)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.3)]">
        <ul className="flex justify-around items-center h-16 px-1">
          {visibleTabs.map((tab) => (
            <li key={tab.name} className="flex-1 h-full">
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center w-full h-full space-y-1 relative transition-colors ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute top-0 w-8 h-1 bg-blue-600 dark:bg-blue-400 rounded-b-full shadow-[0_2px_8px_rgba(37,99,235,0.5)]"></div>
                    )}
                    <div className="relative mt-1">
                      <tab.icon className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400 drop-shadow-sm scale-110' : 'text-slate-500 dark:text-slate-400'}`} />
                    </div>
                    <span className="text-[10px] font-bold truncate w-full text-center px-1">
                      {tab.name}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Floating Action Button (FAB) pour la Carte Membre (Droite) */}
      <button
        onClick={() => setIsCardOpen(true)}
        className="fab-button fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 flex items-center justify-center p-4 rounded-full bg-gradient-to-r from-blue-600/70 to-indigo-600/70 backdrop-blur-xl border border-white/40 dark:border-white/10 text-white shadow-[0_8px_30px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.5)] hover:bg-gradient-to-r hover:from-blue-600/80 hover:to-indigo-600/80 hover:-translate-y-1 transition-all duration-300 group"
        aria-label="Afficher ma carte de membre"
      >
        <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
        <IdCard size={28} className="drop-shadow-md" />
        {/* Tooltip on desktop (Orienté vers la gauche) */}
        <span className="hidden md:block absolute right-full mr-4 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
          Ma Carte Virtuelle
        </span>
      </button>

      {/* Modales */}
      <MemberCardModal isOpen={isCardOpen} onClose={() => setIsCardOpen(false)} />

    </div>
  );
};

export const MemberLayout: FC = () => {
  const { memberId } = useAuth();
  
  return (
    <NotificationProvider memberId={memberId}>
      <LayoutContent />
    </NotificationProvider>
  );
};
