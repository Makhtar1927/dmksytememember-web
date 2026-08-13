import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, Clock, XCircle, CalendarDays, Wallet, Target, Activity, FileText, TrendingUp, BarChart3, PieChart, Users, Award } from 'lucide-react';
import { subscribeToPushNotifications } from '../utils/pushNotifications';

const SASS_TYPES = ['Magal/Gamou', 'Ziaar', 'Keur Serigne Touba', 'Cahier Serigne Mountakha', 'Projets', 'Achat Carte Membre', 'Autres'];
const MONTHS = [
  { label: 'Janvier', value: 0 }, { label: 'Février', value: 1 }, { label: 'Mars', value: 2 },
  { label: 'Avril', value: 3 }, { label: 'Mai', value: 4 }, { label: 'Juin', value: 5 },
  { label: 'Juillet', value: 6 }, { label: 'Août', value: 7 }, { label: 'Septembre', value: 8 },
  { label: 'Octobre', value: 9 }, { label: 'Novembre', value: 10 }, { label: 'Décembre', value: 11 },
  { label: 'Tout', value: -1 }
];

interface MemberInfo {
  id: string;
  first_name: string;
  last_name: string;
  sector?: string;
  role?: string;
  email?: string;
  photo_url?: string;
  sass_magal?: number;
  sass_ziaar?: number;
  sass_kst?: number;
  sass_cahier?: number;
  sass_projets?: number;
  sass_autres?: number;
  [key: string]: unknown;
}

interface MemberContribution {
  id: string;
  member_id: string;
  amount: number;
  payment_date: string;
  status: string;
  sass_type?: string;
  payment_method?: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [contributions, setContributions] = useState<MemberContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyMonth, setHistoryMonth] = useState<number>(-1);
  const [reportMonth, setReportMonth] = useState<number>(() => {
    const prev = new Date().getMonth() - 1;
    return prev < 0 ? 11 : prev;
  });

  const [monthlyReportData, setMonthlyReportData] = useState<{
    monthName: string;
    year: number;
    totalCollected: number;
    totalContributors: number;
    totalTransactions: number;
    byRubric: Record<string, number>;
    topRubric: string;
    topRubricAmount: number;
  } | null>(null);

  const fetchUserData = useCallback(async () => {
    try {
      if (user?.email) {
        const { data: member } = await supabase
          .from('members')
          .select('*')
          .eq('email', user.email)
          .single();

        if (member) {
          setMemberInfo(member as MemberInfo);

          const { data: contribs } = await supabase
            .from('sass_contributions')
            .select('*')
            .eq('member_id', member.id)
            .order('payment_date', { ascending: false });

          setContributions((contribs || []) as MemberContribution[]);

          setTimeout(() => {
            if (member.id) {
              subscribeToPushNotifications(member.id);
            }
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Erreur de récupération des données:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchMonthlyReport = useCallback(async (targetM: number) => {
    try {
      const now = new Date();
      let targetYear = now.getFullYear();
      if (targetM > now.getMonth()) {
        targetYear -= 1;
      }

      const monthObj = MONTHS.find(m => m.value === targetM);
      const monthName = monthObj ? monthObj.label : '';

      const startDate = new Date(targetYear, targetM, 1).toISOString();
      const endDate = new Date(targetYear, targetM + 1, 0, 23, 59, 59).toISOString();

      const { data: reportContribs } = await supabase
        .from('sass_contributions')
        .select('amount, sass_type, member_id')
        .eq('status', 'Validé')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      const contribs = reportContribs || [];
      let totalCollected = 0;
      const byRubric: Record<string, number> = {};
      const contributorsSet = new Set<string>();

      contribs.forEach(c => {
        totalCollected += c.amount;
        const type = c.sass_type || 'Autres';
        byRubric[type] = (byRubric[type] || 0) + c.amount;
        if (c.member_id) contributorsSet.add(c.member_id);
      });

      let topRubric = 'N/A';
      let topRubricAmount = 0;
      Object.entries(byRubric).forEach(([rubric, amount]) => {
        if (amount > topRubricAmount) {
          topRubricAmount = amount;
          topRubric = rubric;
        }
      });

      setMonthlyReportData({
        monthName,
        year: targetYear,
        totalCollected,
        totalContributors: contributorsSet.size,
        totalTransactions: contribs.length,
        byRubric,
        topRubric,
        topRubricAmount
      });
    } catch (err) {
      console.error("Erreur génération rapport mensuel:", err);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchUserData();
    });

    const channel = supabase
      .channel('member_dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => fetchUserData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sass_contributions' }, () => {
        fetchUserData();
        fetchMonthlyReport(reportMonth);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchUserData, fetchMonthlyReport, reportMonth]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchMonthlyReport(reportMonth);
    });
  }, [reportMonth, fetchMonthlyReport]);

  useEffect(() => {
    if (!memberInfo?.id) return;

    const channel = supabase
      .channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sass_contributions', filter: `member_id=eq.${memberInfo.id}` },
        (payload) => {
          console.log('Changement détecté en temps réel:', payload);
          fetchUserData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberInfo?.id, fetchUserData]);

  const stats = useMemo(() => {
    if (!memberInfo) return null;

    const goals: Record<string, number> = {
      'Magal/Gamou': memberInfo.sass_magal || 0,
      'Ziaar': memberInfo.sass_ziaar || 0,
      'Keur Serigne Touba': memberInfo.sass_kst || 0,
      'Cahier Serigne Mountakha': memberInfo.sass_cahier || 0,
      'Projets': memberInfo.sass_projets || 0,
      'Achat Carte Membre': 0, // Sera mis à jour dynamiquement plus bas
      'Autres': memberInfo.sass_autres || 0
    };

    const paid: Record<string, number> = {
      'Magal/Gamou': 0, 'Ziaar': 0, 'Keur Serigne Touba': 0,
      'Cahier Serigne Mountakha': 0, 'Projets': 0, 'Achat Carte Membre': 0, 'Autres': 0, 'Général': 0
    };

    let totalPaid = 0;

    contributions.forEach(c => {
      const status = c.status || 'Validé';
      if (status === 'Validé') {
        totalPaid += c.amount;
        const type = c.sass_type || 'Autres';
        if (paid[type] !== undefined) {
          paid[type] += c.amount;
        } else {
          paid['Autres'] += c.amount;
        }
      }
    });

    // Si on a payé (ou en attente) pour la carte, l'objectif devient de 2000 FCFA
    if (paid['Achat Carte Membre'] > 0) {
      goals['Achat Carte Membre'] = 2000;
    }

    // On calcule le totalGoal APRES avoir potentiellement ajouté l'objectif de la carte
    const totalGoal = Object.values(goals).reduce((a, b) => a + b, 0);
    const globalProgress = totalGoal > 0 ? Math.min(100, Math.round((totalPaid / totalGoal) * 100)) : 0;
    
    let statusText = 'À jour';
    let statusColor = '#10b981'; // bg-emerald-500, text-emerald-500
    if (globalProgress < 40 && totalGoal > 0) {
      statusText = 'En retard';
      statusColor = '#ef4444'; // bg-red-500
    } else if (globalProgress < 100 && totalGoal > 0) {
      statusText = 'En cours';
      statusColor = '#f59e0b'; // bg-amber-500
    }

    return { goals, paid, totalGoal, totalPaid, globalProgress, statusText, statusColor };
  }, [memberInfo, contributions]);

  const historyList = useMemo(() => {
    if (historyMonth === -1) return contributions;
    return contributions.filter(c => new Date(c.payment_date).getMonth() === historyMonth);
  }, [contributions, historyMonth]);

  if (loading || !stats) {
    return (
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center p-8 relative z-10">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600/30 border-t-blue-600 drop-shadow-md"></div>
        <p className="mt-6 text-sm font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400 animate-pulse">Chargement sécurisé...</p>
      </div>
    );
  }

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.globalProgress / 100) * circumference;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-6 md:space-y-8 relative z-10 pb-40 md:pb-8">
      {/* Profil Header */}
      <div className="flex items-center rounded-[32px] bg-white/60 dark:bg-slate-900/50 p-5 md:p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white/50 dark:border-slate-700/50 transition-all duration-500 hover:shadow-2xl">
        <div className="mr-5 flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-blue-500 to-blue-700 text-3xl font-black text-white shadow-lg shadow-blue-600/30 overflow-hidden border-2 border-white/20">
          {memberInfo?.photo_url ? (
            <img src={memberInfo.photo_url} alt="Profil" className="h-full w-full object-cover" />
          ) : (
            <span>{memberInfo?.first_name?.charAt(0)}{memberInfo?.last_name?.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-black text-slate-900 dark:text-white md:text-3xl tracking-tight transition-colors">
            {memberInfo?.first_name} {memberInfo?.last_name}
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 transition-colors mt-0.5">
            {memberInfo?.role} • Secteur {memberInfo?.sector}
          </p>
          <div 
            className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-black tracking-wide uppercase shadow-sm"
            style={{ backgroundColor: `${stats.statusColor}20`, color: stats.statusColor, border: `1px solid ${stats.statusColor}30` }}
          >
            {stats.statusText}
          </div>
        </div>
      </div>



      {/* Jauge Globale */}
      <div className="rounded-[32px] bg-white/60 dark:bg-slate-900/50 p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white/50 dark:border-slate-700/50 transition-all duration-500">
        <h3 className="mb-8 text-center text-xl font-black text-slate-800 dark:text-slate-100 transition-colors">Bilan Annuel des Engagements</h3>
        <div className="flex items-center justify-between">
          <div className="flex flex-1 flex-col items-center">
            <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-[20px] mb-3 shadow-inner">
              <Target className="text-slate-500 dark:text-slate-400" size={28} />
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Objectif</span>
            <span className="text-lg font-black text-slate-900 dark:text-white md:text-2xl">
              {stats.totalGoal.toLocaleString('fr-FR')} <span className="text-sm text-slate-400 font-bold">F</span>
            </span>
          </div>

          <div className="relative flex items-center justify-center mx-4">
            <svg width="130" height="130" viewBox="0 0 100 100" className="transform -rotate-90 drop-shadow-md">
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={`${stats.statusColor}20`}
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={stats.statusColor}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black drop-shadow-sm" style={{ color: stats.statusColor }}>
                {stats.globalProgress}%
              </span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Réalisé</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-[20px] mb-3 shadow-inner border border-emerald-100 dark:border-emerald-900/30">
              <Wallet className="text-emerald-500 dark:text-emerald-400" size={28} />
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Cotisé</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 md:text-2xl drop-shadow-sm">
              {stats.totalPaid.toLocaleString('fr-FR')} <span className="text-sm opacity-60 font-bold">F</span>
            </span>
          </div>
        </div>

        {stats.totalGoal > stats.totalPaid && (
          <div className="mt-8 rounded-2xl border border-orange-200/50 dark:border-orange-900/50 bg-orange-50/80 dark:bg-orange-900/20 p-4 text-center transition-colors shadow-inner">
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
              Reste à cotiser : <span className="font-black text-orange-800 dark:text-orange-300">{(stats.totalGoal - stats.totalPaid).toLocaleString('fr-FR')} FCFA</span>
            </p>
          </div>
        )}
      </div>

      {/* Détails par Sass */}
      <div>
        <h3 className="mb-5 ml-2 text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight transition-colors">Prévisions par Rubrique</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SASS_TYPES.map(type => {
            const goal = stats.goals[type] || 0;
            const paid = stats.paid[type] || 0;
            if (goal === 0 && paid === 0) return null;
            
            const pct = goal > 0 ? Math.min(100, Math.round((paid / goal) * 100)) : (paid > 0 ? 100 : 0);
            const isCompleted = pct >= 100;

            return (
              <div key={type} className="rounded-3xl bg-white/60 dark:bg-slate-900/50 p-6 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200 transition-colors">{type}</span>
                  {isCompleted ? (
                    <CheckCircle size={22} className="text-emerald-500 dark:text-emerald-400 drop-shadow-sm" />
                  ) : (
                    <Clock size={22} className="text-amber-500 dark:text-amber-400" />
                  )}
                </div>
                <div className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span className="font-black text-slate-900 dark:text-white text-lg">{paid.toLocaleString('fr-FR')} F</span> <span className="opacity-70">/ {goal.toLocaleString('fr-FR')} F</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/50 dark:bg-slate-800/80 shadow-inner">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out relative rounded-full ${isCompleted ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                    style={{ width: `${pct}%` }}
                  >
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historique */}
      <div>
        <h3 className="mb-5 ml-2 text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight transition-colors">Mon Historique</h3>
        
        {/* Filtres mois (scrollable horizontal) */}
        <div className="mb-6 flex gap-3 overflow-x-auto pb-3 custom-scrollbar px-1">
          {MONTHS.map(m => (
            <button
              key={m.value}
              onClick={() => setHistoryMonth(m.value)}
              className={`whitespace-nowrap rounded-2xl border px-5 py-2.5 text-sm font-bold transition-all duration-300 ${
                historyMonth === m.value 
                  ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/40 scale-105' 
                  : 'border-white/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md text-slate-600 dark:text-slate-300 hover:bg-white/90 dark:hover:bg-slate-700/80 hover:shadow-md'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="overflow-hidden rounded-[32px] bg-white/60 dark:bg-slate-900/50 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white/50 dark:border-slate-700/50 transition-colors">
          {historyList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400 dark:text-slate-500">
              <CalendarDays size={64} className="mb-5 opacity-40 drop-shadow-sm" />
              <p className="text-base font-bold tracking-wide">Aucune cotisation trouvée.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
              {historyList.map(c => {
                const status = c.status || 'Validé';
                const isValidated = status === 'Validé';
                const isPending = status === 'En attente';
                const isRefused = status === 'Annulé' || status === 'Refusé';

                return (
                  <div key={c.id} className="flex items-center p-5 md:p-6 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors duration-300">
                    <div className={`mr-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] shadow-inner border ${
                      isValidated 
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30'
                        : isPending 
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/30'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/30'
                    }`}>
                      <Activity size={26} />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-black text-slate-900 dark:text-white tracking-wide">Sass {c.sass_type || 'Général'}</p>
                        {isValidated && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                            <CheckCircle size={12} /> Validé
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300/40 animate-pulse">
                            <Clock size={12} /> En attente
                          </span>
                        )}
                        {isRefused && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300/40">
                            <XCircle size={12} /> {status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                        {new Date(c.payment_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {c.payment_method ? ` • Via ${c.payment_method}` : ''}
                      </p>
                    </div>
                    <div className={`text-xl font-black ${
                      isValidated 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : isPending 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-slate-400 dark:text-slate-500 line-through'
                    }`}>
                      +{c.amount.toLocaleString('fr-FR')} F
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RAPPORT MENSUEL AUTO-GÉNÉRÉ (Du Dahira Entier) */}
      <div className="rounded-[32px] bg-gradient-to-br from-slate-900/90 via-slate-900 to-blue-950 text-white p-6 md:p-8 shadow-2xl shadow-blue-950/30 border border-blue-500/20 backdrop-blur-xl relative overflow-hidden transition-all duration-500 hover:border-blue-500/40">
        {/* Glow ambient background elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none"></div>

        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8 pb-6 border-b border-white/10 relative z-10">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <BarChart3 className="text-blue-400" size={28} />
              Rapport Mensuel Dahira
            </h3>
            <p className="text-xs md:text-sm text-slate-300 mt-1 font-medium">
              Bilan consolidé de l'ensemble du Dahira pour <span className="text-blue-300 font-bold">{monthlyReportData?.monthName} {monthlyReportData?.year}</span>
            </p>
          </div>

          {/* Month Selector for Report */}
          <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(Number(e.target.value))}
              className="bg-transparent text-white text-xs font-bold px-3 py-1.5 focus:outline-none cursor-pointer border-none"
            >
              {MONTHS.filter(m => m.value !== -1).map(m => (
                <option key={m.value} value={m.value} className="bg-slate-900 text-white">
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Report Content */}
        {!monthlyReportData ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent mr-3"></div>
            <span className="text-sm font-medium">Analyse des données du Dahira...</span>
          </div>
        ) : (
          <div className="space-y-8 relative z-10">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <div className="rounded-2xl bg-white/5 p-4 border border-white/10 hover:bg-white/10 transition-all">
                <div className="flex items-center justify-between text-blue-400 mb-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Collecte Totale</span>
                  <Wallet size={18} />
                </div>
                <div className="text-lg sm:text-xl font-black text-emerald-400">
                  {monthlyReportData.totalCollected.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-400">FCFA</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-semibold">Toutes cotisations confondues</div>
              </div>

              <div className="rounded-2xl bg-white/5 p-4 border border-white/10 hover:bg-white/10 transition-all">
                <div className="flex items-center justify-between text-indigo-400 mb-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Cotisants</span>
                  <Users size={18} />
                </div>
                <div className="text-lg sm:text-xl font-black text-white">
                  {monthlyReportData.totalContributors} <span className="text-xs font-bold text-slate-400">Membres</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-semibold">Membres ayant contribué</div>
              </div>

              <div className="rounded-2xl bg-white/5 p-4 border border-white/10 hover:bg-white/10 transition-all">
                <div className="flex items-center justify-between text-purple-400 mb-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Opérations</span>
                  <TrendingUp size={18} />
                </div>
                <div className="text-lg sm:text-xl font-black text-white">
                  {monthlyReportData.totalTransactions} <span className="text-xs font-bold text-slate-400">Paiements</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-semibold">Transactions validées</div>
              </div>

              <div className="rounded-2xl bg-white/5 p-4 border border-white/10 hover:bg-white/10 transition-all">
                <div className="flex items-center justify-between text-amber-400 mb-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Rubrique Phare</span>
                  <Award size={18} />
                </div>
                <div className="text-sm font-black text-amber-300 truncate" title={monthlyReportData.topRubric}>
                  {monthlyReportData.topRubric}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                  {monthlyReportData.topRubricAmount.toLocaleString('fr-FR')} FCFA
                </div>
              </div>
            </div>

            {/* Visual Diagram: Breakdown by Rubrics */}
            <div className="rounded-2xl bg-white/5 p-5 md:p-6 border border-white/10">
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                  <PieChart size={18} className="text-blue-400" />
                  Répartition Diagramme par Rubrique ({monthlyReportData.monthName})
                </h4>
                <span className="text-xs font-bold text-slate-400">Visualisation 100%</span>
              </div>

              {monthlyReportData.totalCollected === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm font-medium">
                  Aucune cotisation enregistrée sur ce mois pour le Dahira.
                </div>
              ) : (
                <div className="space-y-4">
                  {SASS_TYPES.map((rubric, idx) => {
                    const amount = monthlyReportData.byRubric[rubric] || 0;
                    if (amount === 0) return null;
                    const pct = monthlyReportData.totalCollected > 0 
                      ? Math.round((amount / monthlyReportData.totalCollected) * 100) 
                      : 0;

                    const colors = [
                      'from-blue-500 to-indigo-600',
                      'from-emerald-500 to-teal-600',
                      'from-purple-500 to-pink-600',
                      'from-amber-500 to-orange-600',
                      'from-cyan-500 to-blue-600',
                      'from-rose-500 to-red-600',
                      'from-slate-400 to-slate-600'
                    ];
                    const barColor = colors[idx % colors.length];

                    return (
                      <div key={rubric} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-200">{rubric}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">{amount.toLocaleString('fr-FR')} FCFA</span>
                            <span className="px-2 py-0.5 rounded-md bg-white/10 text-blue-300 font-extrabold text-[10px]">
                              {pct}%
                            </span>
                          </div>
                        </div>
                        <div className="h-3 w-full bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-white/5">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out shadow-sm`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Synthetic Summary Text Note */}
            <div className="rounded-2xl bg-blue-600/10 border border-blue-500/30 p-4 md:p-5 flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                <FileText size={22} />
              </div>
              <div className="text-xs md:text-sm text-slate-200 leading-relaxed">
                <span className="font-extrabold text-white block mb-1">Résumé Synthétique de l'État du Dahira :</span>
                Au cours du mois de <span className="font-bold text-blue-300">{monthlyReportData.monthName} {monthlyReportData.year}</span>, le Dahira a mobilisé un montant global de <span className="font-bold text-emerald-400">{monthlyReportData.totalCollected.toLocaleString('fr-FR')} FCFA</span> avec l'engagement actif de <span className="font-bold text-white">{monthlyReportData.totalContributors} membres</span>. 
                {monthlyReportData.topRubricAmount > 0 && (
                  <span> La dynamique principale a été portée par la rubrique <span className="font-bold text-amber-300">{monthlyReportData.topRubric}</span> ({monthlyReportData.topRubricAmount.toLocaleString('fr-FR')} FCFA).</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Espace de défilement massif pour éviter le masquage par la barre de navigation et le FAB */}
      <div className="h-44 w-full shrink-0" aria-hidden="true" />
    </div>
  );
}
