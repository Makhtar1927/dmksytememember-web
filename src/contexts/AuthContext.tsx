import { createContext, useContext, useEffect, useState, useRef, type ReactNode, type FC } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string;
  memberId: string | null;
  memberStatus: string;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userRole: 'Membre Simple',
  memberId: null,
  memberStatus: 'Actif',
  loading: true,
  signOut: async () => {},
});

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string>('Membre Simple');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberStatus, setMemberStatus] = useState<string>('Actif');
  const [loading, setLoading] = useState(true);
  const fetchingEmailRef = useRef<string | null>(null);

  const signOut = async () => {
    fetchingEmailRef.current = null;
    await supabase.auth.signOut();
  };

  const fetchUserRole = async (currentUser: User) => {
    if (!currentUser?.email) {
      setLoading(false);
      return;
    }
    if (fetchingEmailRef.current === currentUser.email) return;
    fetchingEmailRef.current = currentUser.email;
    
    // Timeout de sécurité : si la requête prend trop de temps, on libère le loading
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 10000);
    
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, role, status')
        .eq('email', currentUser.email)
        .maybeSingle(); // maybeSingle ne lève pas d'erreur si aucun résultat
        
      if (error) {
        console.error("Erreur récupération rôle membre:", error);
        return;
      }
        
      if (data) {
        if (data.role === 'Administrateur général') {
          await supabase.auth.signOut();
          // Pas d'alert() bloquant — on redirige via le state
          setUserRole('Membre Simple');
          setMemberId(null);
          setMemberStatus('Inactif');
          return;
        }
        setUserRole(data.role || 'Membre Simple');
        setMemberId(data.id);
        setMemberStatus(data.status || 'Actif');
      } else {
        // Membre non trouvé dans la table members
        console.warn('Aucun membre trouvé pour:', currentUser.email);
      }
    } catch (error) {
      console.error("Erreur récupération rôle:", error);
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user);
      } else {
        setUserRole('Membre Simple');
        setMemberId(null);
        setMemberStatus('Actif');
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Écoute en temps réel des modifications du profil du membre
  useEffect(() => {
    if (!memberId) return;

    const channel = supabase
      .channel('member-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'members',
          filter: `id=eq.${memberId}`,
        },
        (payload) => {
          if (payload.new && payload.new.status) {
            setMemberStatus(payload.new.status);
            if (payload.new.role) {
              setUserRole(payload.new.role);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId]);

  return (
    <AuthContext.Provider value={{ user, session, userRole, memberId, memberStatus, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

