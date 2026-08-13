import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Users, Activity, Search, ChevronDown } from 'lucide-react';

const SECTORS = [
  "Vaisselle", "Café", "Restauration", "Organisation", "Sonorisation",
  "Visuelle", "Bétail", "Cuisine", "Eau & Hygiène", "Protocole",
  "Decoration", "Culturelle", "Conservatoire", "Campagne", "Jayanté Kat yi",
  "Nouveau"
];

const SASS_TYPES = ['Magal/Gamou', 'Ziaar', 'Keur Serigne Touba', 'Cahier Serigne Mountakha', 'Projets', 'Autres'];

const MONTHS = [
  { label: 'Tous les mois', value: -1 },
  { label: 'Janvier', value: 0 }, { label: 'Février', value: 1 }, { label: 'Mars', value: 2 },
  { label: 'Avril', value: 3 }, { label: 'Mai', value: 4 }, { label: 'Juin', value: 5 },
  { label: 'Juillet', value: 6 }, { label: 'Août', value: 7 }, { label: 'Septembre', value: 8 },
  { label: 'Octobre', value: 9 }, { label: 'Novembre', value: 10 }, { label: 'Décembre', value: 11 }
];

interface MemberLight {
  id: string;
  first_name: string;
  last_name: string;
  sector?: string;
  phone?: string;
  sass_magal?: number;
  sass_ziaar?: number;
  sass_kst?: number;
  sass_cahier?: number;
  sass_projets?: number;
  sass_autres?: number;
  [key: string]: any;
}

interface ContribItem {
  id: string;
  member_id: string;
  amount: number;
  payment_date: string;
  sass_type?: string;
}

interface SectorPerf {
  name: string;
  goal: number;
  collected: number;
  percent: number;
}

export default function Statistiques() {
  const [loading, setLoading] = useState(true);
  
  const [allMembersLight, setAllMembersLight] = useState<MemberLight[]>([]);
  
  const [stats, setStats] = useState<{
    activeMembersCount: number;
    totalGoal: number;
    totalCollected: number;
    recoveryRate: number;
    chartData: Record<string, number>;
    maxChartValue: number;
    sectorPerformance: SectorPerf[];
    treasuryIncomes?: number;
    treasuryExpenses?: number;
    singleMember: MemberLight | null;
    filteredContribs: ContribItem[];
    filteredMembers: MemberLight[];
  }>({
    activeMembersCount: 0,
    totalGoal: 0,
    totalCollected: 0,
    recoveryRate: 0,
    chartData: {},
    maxChartValue: 1,
    sectorPerformance: [],
    singleMember: null,
    filteredContribs: [],
    filteredMembers: []
  });

  const [selectedMonth, setSelectedMonth] = useState<number>(-1);
  const [selectedSector, setSelectedSector] = useState<string>('Tous');
  const [selectedSass, setSelectedSass] = useState<string>('Tous');
  const [searchMember, setSearchMember] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMembersLight = async () => {
      const { data } = await supabase.from('members').select('id, first_name, last_name, sector');
      if (data) setAllMembersLight(data as MemberLight[]);
    };
    fetchMembersLight();

    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchGlobalData = useCallback(async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();

      const { data: dashboardStats, error: rpcError } = await supabase.rpc('get_statistics_dashboard', {
        p_month: selectedMonth,
        p_year: currentYear,
        p_sector: selectedSector,
        p_sass: selectedSass
      });

      if (rpcError) {
        console.error("Erreur RPC:", rpcError);
        window.alert("Attention: Impossible de charger les stats.");
        return;
      }

      let singleMemberData: MemberLight | null = null;
      let filteredMemData: MemberLight[] = [];
      let filteredContribData: ContribItem[] = [];

      if (selectedMemberId && selectedSector === 'Tous') {
        const { data: memberFull } = await supabase.from('members').select('*').eq('id', selectedMemberId).single();
        if (memberFull) {
          singleMemberData = memberFull as MemberLight;
          const { data: memContribs } = await supabase.from('sass_contributions').select('*').eq('member_id', singleMemberData.id).eq('status', 'Validé');
          filteredContribData = ((memContribs || []) as ContribItem[]).filter(c => selectedMonth === -1 || new Date(c.payment_date).getMonth() === selectedMonth);
        }
      } 
      else if (selectedSector !== 'Tous') {
        const { data: sectorMembers } = await supabase.from('members').select('*').eq('sector', selectedSector);
        filteredMemData = (sectorMembers || []) as MemberLight[];
        
        const memberIds = filteredMemData.map(m => m.id);
        if (memberIds.length > 0) {
          const { data: recentContribs } = await supabase
            .from('sass_contributions')
            .select('member_id, amount, payment_date, sass_type')
            .in('member_id', memberIds)
            .eq('status', 'Validé');
            
          filteredContribData = ((recentContribs || []) as ContribItem[]).filter(c => {
            if (selectedMonth === -1) return true;
            const d = new Date(c.payment_date);
            return d.getMonth() === selectedMonth && d.getFullYear() === currentYear;
          });
        }
      }

      if (dashboardStats) {
        setStats({
          activeMembersCount: dashboardStats.activeMembersCount || 0,
          totalGoal: dashboardStats.totalGoal || 0,
          totalCollected: dashboardStats.totalCollected || 0,
          recoveryRate: dashboardStats.recoveryRate || 0,
          chartData: dashboardStats.chartData || {},
          maxChartValue: Math.max(...Object.values(dashboardStats?.chartData || { a: 1 }) as number[], 1),
          sectorPerformance: dashboardStats.sectorPerformance || [],
          treasuryIncomes: dashboardStats.treasuryIncomes || 0,
          treasuryExpenses: dashboardStats.treasuryExpenses || 0,
          singleMember: singleMemberData,
          filteredMembers: filteredMemData,
          filteredContribs: filteredContribData
        });
      }

    } catch (error) {
      console.error("Erreur chargement stats:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedSector, selectedSass, selectedMemberId]);

  useEffect(() => {
    fetchGlobalData();

    // S'abonner aux changements en temps réel
    const channel = supabase.channel('stats_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'treasury_incomes' }, () => fetchGlobalData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'treasury_expenses' }, () => fetchGlobalData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sass_contributions' }, () => fetchGlobalData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => fetchGlobalData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchGlobalData]);

  const searchSuggestions = useMemo(() => {
    if (!searchMember || !showSearchDropdown) return [];
    return allMembersLight.filter((m: any) => {
      const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
      return fullName.includes(searchMember.toLowerCase());
    }).slice(0, 5);
  }, [searchMember, showSearchDropdown, allMembersLight]);

  const handleSelectMember = (id: string, firstName: string, lastName: string) => {
    setSearchMember(`${firstName} ${lastName}`);
    setSelectedMemberId(id);
    setShowSearchDropdown(false);
  };

  if (loading && !stats.totalGoal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col relative z-10 pb-40 md:pb-8">
      <div className="p-6 md:p-8 pb-4">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Statistiques</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium md:text-lg transition-colors">Dashboard Présidence / Direction</p>
      </div>

      <div className="px-4 md:px-8 mb-6 z-20">
        {/* SEARCH BAR */}
        <div className="relative mb-5" ref={searchRef}>
          <div className="flex items-center rounded-[24px] bg-white/60 dark:bg-slate-900/50 px-4 py-3.5 border border-white/50 dark:border-slate-700/50 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all group">
            <Search size={22} className="text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-blue-500" />
            <input 
              type="text" 
              placeholder="Rechercher un membre pour voir ses stats..." 
              value={searchMember}
              onChange={(e) => {
                setSearchMember(e.target.value);
                if (e.target.value.trim() === '') setSelectedMemberId(null);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="ml-3 w-full bg-transparent text-base font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-colors"
            />
          </div>
          
          {showSearchDropdown && searchSuggestions.length > 0 && (
            <div className="absolute top-[110%] left-0 right-0 z-50 rounded-[24px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-white/20 dark:border-slate-700/50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
              {searchSuggestions.map((m) => (
                <button 
                  key={m.id} 
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border-b border-slate-100/50 dark:border-slate-800/50 last:border-0"
                  onClick={() => handleSelectMember(m.id, m.first_name, m.last_name)}
                >
                  <span className="font-black text-slate-900 dark:text-white text-base transition-colors">{m.first_name} {m.last_name}</span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-[12px] border border-slate-200/50 dark:border-slate-700/50">{m.sector}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* FILTERS */}
        <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar md:flex-wrap">
          <div className="relative shrink-0">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 ml-1 transition-colors">Mois</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="appearance-none rounded-[16px] border border-white/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/50 px-5 py-3 pr-10 text-sm font-black text-slate-700 dark:text-slate-300 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-sm cursor-pointer"
            >
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <ChevronDown size={18} className="absolute bottom-3.5 right-4 text-slate-400 pointer-events-none" />
          </div>
          
          <div className="relative shrink-0">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 ml-1 transition-colors">Secteur</label>
            <select 
              value={selectedSector} 
              onChange={(e) => setSelectedSector(e.target.value)}
              className="appearance-none rounded-[16px] border border-white/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/50 px-5 py-3 pr-10 text-sm font-black text-slate-700 dark:text-slate-300 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-sm cursor-pointer"
            >
              <option value="Tous">Tous les secteurs</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={18} className="absolute bottom-3.5 right-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative shrink-0">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 ml-1 transition-colors">Catégorie</label>
            <select 
              value={selectedSass} 
              onChange={(e) => setSelectedSass(e.target.value)}
              className="appearance-none rounded-[16px] border border-white/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/50 px-5 py-3 pr-10 text-sm font-black text-slate-700 dark:text-slate-300 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-sm cursor-pointer"
            >
              <option value="Tous">Toutes catégories</option>
              {SASS_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={18} className="absolute bottom-3.5 right-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-8 max-w-4xl w-full mx-auto space-y-6 z-10">
        
        {/* KPI GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-5 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-blue-100 dark:bg-blue-500/20 mb-4 shadow-inner group-hover:scale-110 transition-transform">
              <Users size={24} className="text-blue-600 dark:text-blue-400 drop-shadow-sm" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white transition-colors tracking-tight">{stats.activeMembersCount}</div>
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">Membres filtrés</div>
          </div>
          
          <div className="rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-5 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-emerald-100 dark:bg-emerald-500/20 mb-4 shadow-inner group-hover:scale-110 transition-transform">
              <Activity size={24} className="text-emerald-600 dark:text-emerald-400 drop-shadow-sm" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white transition-colors tracking-tight">{stats.recoveryRate}%</div>
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">Taux Recouvrement</div>
          </div>

          <div className="rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-5 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-indigo-100 dark:bg-indigo-500/20 mb-4 shadow-inner group-hover:scale-110 transition-transform">
              <TrendingUp size={24} className="text-indigo-600 dark:text-indigo-400 drop-shadow-sm" />
            </div>
            <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white transition-colors tracking-tight">{(stats.treasuryIncomes || 0).toLocaleString('fr-FR')} F</div>
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">Total Encaissements</div>
          </div>

          <div className="rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-5 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-rose-100 dark:bg-rose-500/20 mb-4 shadow-inner group-hover:scale-110 transition-transform">
              <TrendingUp size={24} className="text-rose-600 dark:text-rose-400 drop-shadow-sm rotate-180" />
            </div>
            <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white transition-colors tracking-tight">{(stats.treasuryExpenses || 0).toLocaleString('fr-FR')} F</div>
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">Total Décaissements</div>
          </div>

          <div className="col-span-2 md:col-span-4 rounded-[32px] bg-gradient-to-br from-slate-800 to-slate-950 dark:from-slate-900 dark:to-black p-6 md:p-8 shadow-xl shadow-slate-900/20 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden transition-all hover:shadow-2xl border border-slate-700/50">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
            
            <div className="relative z-10">
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Total SASS Collecté</div>
              <div className="text-3xl md:text-5xl font-black text-emerald-400 drop-shadow-sm tracking-tight">{stats.totalCollected.toLocaleString('fr-FR')} F</div>
            </div>
            <div className="text-left md:text-right relative z-10">
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Objectif SASS</div>
              <div className="text-2xl md:text-3xl font-black text-white drop-shadow-sm tracking-tight">{stats.totalGoal.toLocaleString('fr-FR')} F</div>
            </div>
          </div>
        </div>

        {/* SINGLE MEMBER PROFILE */}
        {stats.singleMember && (
          <div className="rounded-[32px] border border-emerald-200/50 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-6 md:p-8 shadow-lg shadow-emerald-200/30 dark:shadow-slate-900/30 transition-all">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-emerald-500 shadow-lg shadow-emerald-500/30 text-2xl font-black text-white">
                {stats.singleMember.first_name.charAt(0)}{stats.singleMember.last_name.charAt(0)}
              </div>
              <div>
                <h3 className="text-2xl font-black text-emerald-900 dark:text-emerald-100 transition-colors">{stats.singleMember.first_name} {stats.singleMember.last_name}</h3>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1 transition-colors">{stats.singleMember.sector} • {stats.singleMember.phone || 'Pas de numéro'}</p>
              </div>
            </div>
            
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-3 transition-colors">Engagements (Prévisions) :</h4>
            <div className="flex flex-wrap gap-2 mb-8">
              {SASS_TYPES.map(type => {
                const key = 'sass_' + (type === 'Magal/Gamou' ? 'magal' : type === 'Keur Serigne Touba' ? 'kst' : type === 'Cahier Serigne Mountakha' ? 'cahier' : type.toLowerCase());
                const amount = stats.singleMember ? stats.singleMember[key] || 0 : 0;
                if (amount === 0) return null;
                return (
                  <div key={type} className="rounded-[12px] bg-emerald-100/80 dark:bg-emerald-500/20 px-4 py-2 text-sm font-black text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-500/30 shadow-sm transition-colors">
                    {type}: {amount.toLocaleString('fr-FR')} F
                  </div>
                );
              })}
            </div>
            
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-3 transition-colors">Cotisations (Ce mois-ci) :</h4>
            <div className="rounded-[24px] bg-white/60 dark:bg-slate-900/50 border border-emerald-200/50 dark:border-emerald-500/30 divide-y divide-emerald-100/50 dark:divide-emerald-800/30 overflow-hidden shadow-inner transition-colors">
              {stats.filteredContribs.length === 0 ? (
                <div className="p-6 text-center text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors">Aucune cotisation enregistrée pour ce mois.</div>
              ) : (
                stats.filteredContribs.map((c: any) => (
                  <div key={c.id} className="flex justify-between items-center p-4 px-6 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-colors">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors">{new Date(c.payment_date).toLocaleDateString()} - {c.sass_type}</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 transition-colors">+{c.amount.toLocaleString('fr-FR')} F</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* CHART : REPARTITION SASS */}
        <div className="rounded-[32px] bg-white/60 dark:bg-slate-900/50 p-6 md:p-8 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:shadow-xl">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Comparatif des Encaissements</h2>
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-blue-100 dark:bg-blue-500/20 shadow-inner">
              <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          
          <div className="h-48 flex items-end justify-between gap-2 md:gap-4 px-2">
            {SASS_TYPES.map((type, i) => {
              const amount = stats.chartData[type] || 0;
              const heightPct = Math.max(5, (amount / stats.maxChartValue) * 100);
              const shortLabel = type.split(' ')[0].substring(0, 5);
              
              return (
                <div key={i} className="flex flex-col items-center justify-end h-full flex-1 group relative">
                  <span className="absolute -top-6 text-[11px] font-black text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white dark:bg-slate-800 px-2 py-1 rounded-md shadow-sm border border-slate-100 dark:border-slate-700">
                    {amount > 0 ? (amount/1000).toFixed(0)+'k' : '0'}
                  </span>
                  <div 
                    className="w-full max-w-[40px] rounded-t-[12px] bg-gradient-to-t from-blue-600 to-blue-400 dark:from-blue-700 dark:to-blue-500 transition-all duration-1000 group-hover:shadow-lg group-hover:shadow-blue-500/50 group-hover:from-blue-500 group-hover:to-blue-300" 
                    style={{ height: `${heightPct}%` }}
                  ></div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mt-3 text-center break-all w-full leading-tight transition-colors">
                    {shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTORS OR MEMBERS LIST */}
        {selectedSector === 'Tous' ? (
          <div>
            <h2 className="mb-5 ml-2 text-xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Palmarès des Secteurs (Ce mois)</h2>
            <div className="rounded-[32px] bg-white/60 dark:bg-slate-900/50 p-6 md:p-8 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all">
              {stats.sectorPerformance.length === 0 ? (
                <div className="p-6 text-center text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors">Aucune donnée d'objectif pour ce mois.</div>
              ) : (
                <div className="space-y-6">
                  {stats.sectorPerformance.map((sector: any, i: number) => {
                    let barColor = 'bg-rose-500 dark:bg-rose-500 shadow-rose-500/50';
                    let textColor = 'text-rose-600 dark:text-rose-400';
                    if (sector.percent >= 80) { barColor = 'bg-emerald-500 dark:bg-emerald-500 shadow-emerald-500/50'; textColor = 'text-emerald-600 dark:text-emerald-400'; }
                    else if (sector.percent >= 40) { barColor = 'bg-amber-500 dark:bg-amber-500 shadow-amber-500/50'; textColor = 'text-amber-600 dark:text-amber-400'; }

                    return (
                      <div key={i} className="group">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-black text-slate-900 dark:text-white text-base transition-colors">{i+1}. {sector.name}</span>
                          <span className={`font-black ${textColor} transition-colors`}>{sector.percent}%</span>
                        </div>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 tracking-wide transition-colors">
                          Collecté: {sector.collected.toLocaleString('fr-FR')} F / Obj: {sector.goal.toLocaleString('fr-FR')} F
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100/50 dark:bg-slate-800/50 shadow-inner">
                          <div className={`h-full rounded-full ${barColor} shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all duration-1000`} style={{ width: `${Math.min(100, sector.percent)}%` }}></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="mb-5 ml-2 text-xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Membres du Secteur ({stats.activeMembersCount})</h2>
            <div className="rounded-[32px] bg-white/60 dark:bg-slate-900/50 p-6 md:p-8 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all">
              {stats.filteredMembers.length === 0 ? (
                <div className="p-6 text-center text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors">Aucun membre trouvé.</div>
              ) : (
                <div className="space-y-6">
                  {stats.filteredMembers.map((m: any) => {
                    const amountPaid = stats.filteredContribs.filter((c: any) => c.member_id === m.id).reduce((s: any, c: any) => s + c.amount, 0);
                    const goal = (m.sass_magal||0) + (m.sass_ziaar||0) + (m.sass_kst||0) + (m.sass_cahier||0) + (m.sass_projets||0) + (m.sass_autres||0);
                    const pct = goal > 0 ? Math.round((amountPaid / goal) * 100) : 0;
                    
                    let barColor = 'bg-rose-500 dark:bg-rose-500 shadow-rose-500/50';
                    let textColor = 'text-rose-600 dark:text-rose-400';
                    if (pct >= 80) { barColor = 'bg-emerald-500 dark:bg-emerald-500 shadow-emerald-500/50'; textColor = 'text-emerald-600 dark:text-emerald-400'; }
                    else if (pct >= 40) { barColor = 'bg-amber-500 dark:bg-amber-500 shadow-amber-500/50'; textColor = 'text-amber-600 dark:text-amber-400'; }

                    return (
                      <button 
                        key={m.id} 
                        className="w-full text-left group block rounded-[20px] p-2 -mx-2 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors"
                        onClick={() => handleSelectMember(m.id, m.first_name, m.last_name)}
                      >
                        <div className="flex justify-between items-center mb-2 px-2">
                          <span className="font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{m.first_name} {m.last_name}</span>
                          <span className={`font-black ${textColor} transition-colors`}>{amountPaid.toLocaleString('fr-FR')} F</span>
                        </div>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 tracking-wide transition-colors px-2">
                          Objectif global: {goal.toLocaleString('fr-FR')} F ({pct}%)
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100/50 dark:bg-slate-800/50 shadow-inner px-2">
                          <div className={`h-full rounded-full ${barColor} shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all duration-1000`} style={{ width: `${Math.min(100, pct)}%` }}></div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
