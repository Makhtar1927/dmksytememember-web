import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Moon, Sun, UserPlus } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigate = useNavigate();

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    setError(null);

    // Formatage intelligent: si l'utilisateur tape "DMK-2026-1234", on essaie de trouver son email réel
    let loginEmail = email.trim().toLowerCase();
    if (!loginEmail.includes('@') && loginEmail.startsWith('dmk-')) {
      const { data: resolvedEmail } = await supabase.rpc('get_email_by_dmk_id', { p_dmk_id: loginEmail });
      if (resolvedEmail) {
        loginEmail = resolvedEmail;
      } else {
        loginEmail = `${loginEmail}@dmk.sn`;
      }
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: password.trim(),
    });

    if (authError) {
      if (authError.message.includes('Email not confirmed')) {
        setError('La confirmation par email est activée. Veuillez la désactiver.');
      } else {
        setError('Identifiants incorrects. Veuillez vérifier l\'email et le mot de passe.');
      }
    } else if (authData.user?.email) {
      // Check status of member in database
      const { data: member } = await supabase
        .from('members')
        .select('status')
        .ilike('email', authData.user.email.trim())
        .maybeSingle();

      if (member && (member.status === 'En attente' || member.status === 'Inactif')) {
        await supabase.auth.signOut();
        setError(member.status === 'En attente' 
          ? 'Votre compte est actuellement en attente d\'activation par l\'administrateur.' 
          : 'Votre compte a été désactivé par l\'administrateur.');
        setLoading(false);
        return;
      }

      navigate('/');
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 md:p-12 transition-colors duration-500 overflow-hidden">
      
      {/* Animated Background Bubbles (Glassmorphism Core) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-400/30 dark:bg-blue-600/10 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-cyan-400/20 dark:bg-cyan-800/20 blur-[150px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[30%] left-[20%] w-[50%] h-[50%] rounded-full bg-indigo-400/20 dark:bg-indigo-900/20 blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      {/* Theme Toggle Button */}
      <button 
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-20 p-3 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 shadow-sm hover:scale-110 transition-transform"
        aria-label="Toggle Dark Mode"
      >
        {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
      </button>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo & Header */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-5 h-28 w-28 overflow-hidden rounded-3xl border-2 border-white/60 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 shadow-xl shadow-blue-600/10 dark:shadow-blue-900/20 transition-all duration-500">
            <img 
              src="/icon.png" 
              alt="DMK Logo" 
              className="h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white transition-colors duration-500">DMK</h1>
          <p className="mt-1 text-xs font-bold tracking-[0.2em] text-slate-500 dark:text-slate-400 uppercase transition-colors duration-500">
            Espace Membre
          </p>
        </div>

        {/* Glassmorphic Form Card */}
        <form 
          className="rounded-[32px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-500" 
          onSubmit={handleLogin}
        >
          {error && (
            <div className="mb-6 rounded-xl border border-red-200/50 dark:border-red-900/50 bg-red-50/80 dark:bg-red-900/20 p-4 text-sm font-medium text-red-600 dark:text-red-400 transition-colors duration-500">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Champ Email */}
            <div>
              <label className="mb-2 ml-1 block text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors duration-500">
                Adresse Email ou ID DMK
              </label>
              <div className="relative flex items-center rounded-2xl border border-white/60 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 transition-all focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:bg-white/80 dark:focus-within:bg-slate-800/80 focus-within:ring-4 focus-within:ring-blue-500/20">
                <div className="pl-4 pr-2 text-slate-400 dark:text-slate-500">
                  <Mail size={20} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ex: DMK-2026-XXXX"
                  className="w-full bg-transparent py-4 pr-4 text-base font-semibold text-slate-900 dark:text-white placeholder:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoCapitalize="none"
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div>
              <label className="mb-2 ml-1 block text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors duration-500">
                Mot de passe
              </label>
              <div className="relative flex items-center rounded-2xl border border-white/60 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 transition-all focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:bg-white/80 dark:focus-within:bg-slate-800/80 focus-within:ring-4 focus-within:ring-blue-500/20">
                <div className="pl-4 pr-2 text-slate-400 dark:text-slate-500">
                  <Lock size={20} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="w-full bg-transparent py-4 pr-12 text-base font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoCapitalize="none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 dark:text-slate-500 transition-colors hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-8 flex w-full items-center justify-center rounded-2xl bg-blue-600/90 dark:bg-blue-600 px-4 py-4 text-center text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 focus:outline-none focus:ring-4 focus:ring-blue-600/20 disabled:opacity-70 active:scale-[0.98]"
          >
            {loading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
            ) : (
              'Se Connecter'
            )}
          </button>

          {/* Option S'inscrire */}
          <div className="mt-6 border-t border-slate-200/50 dark:border-slate-800/50 pt-5 text-center">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Pas encore membre ?{' '}
              <Link 
                to="/register" 
                className="inline-flex items-center font-bold text-blue-600 dark:text-blue-400 hover:underline transition-all ml-1"
              >
                <UserPlus size={16} className="mr-1" />
                S'inscrire
              </Link>
            </p>
          </div>
        </form>

        <p className="mt-10 text-center text-xs font-bold tracking-widest text-slate-400/80 dark:text-slate-500 uppercase transition-colors duration-500">
          © {new Date().getFullYear()} DMK • Accès Restreint
        </p>
      </div>
    </div>
  );
}
