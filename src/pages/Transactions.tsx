import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Clock, Search } from 'lucide-react';

interface Member {
  id?: string;
  first_name: string;
  last_name: string;
  sector: string;
}

interface Contribution {
  id: string;
  member_id: string;
  amount: number | string;
  payment_date: string;
  status: string;
  sass_type?: string;
  payment_method?: string;
}

interface Transaction extends Contribution {
  members: Member | null;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'En attente' | 'Validé' | 'Annulé' | 'Tous'>('En attente');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('sass_contributions')
          .select(`
            *,
            members (
              first_name,
              last_name,
              sector
            )
          `)
          .order('payment_date', { ascending: false });

        if (error) {
          console.error("Erreur avec la jointure:", error);
          fallbackFetchTransactions();
          return;
        }
        
        setTransactions((data as unknown as Transaction[]) || []);
      } catch (error) {
        console.error("Erreur fetchTransactions:", error);
      } finally {
        setLoading(false);
      }
    };

    const fallbackFetchTransactions = async () => {
      try {
        const { data: contribsData, error: contribsError } = await supabase
          .from('sass_contributions')
          .select('*')
          .order('payment_date', { ascending: false });

        if (contribsError) throw contribsError;

        if (!contribsData || contribsData.length === 0) {
          setTransactions([]);
          return;
        }

        const contributions = contribsData as Contribution[];
        const memberIds = contributions.map((c) => c.member_id);
        const { data: membersData } = await supabase
          .from('members')
          .select('id, first_name, last_name, sector')
          .in('id', memberIds);

        const members = (membersData || []) as Member[];

        const combined: Transaction[] = contributions.map((c) => ({
          ...c,
          members: members.find((m) => m.id === c.member_id) || null
        }));

        setTransactions(combined);
      } catch (error) {
        console.error("Erreur fallback fetchTransactions:", error);
      }
    };

    fetchTransactions();

    const channel = supabase
      .channel('member_transactions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sass_contributions' }, () => fetchTransactions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => fetchTransactions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAction = async (id: string, action: 'Validé' | 'Annulé') => {
    if (!window.confirm(`Êtes-vous sûr de vouloir ${action.toLowerCase()} cette transaction ?`)) {
      return;
    }

    setProcessingId(id);
    try {
      const updatePayload: { status: string; payment_date?: string } = {
        status: action
      };
      if (action === 'Validé') {
        updatePayload.payment_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('sass_contributions')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;

      setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: action } : t));
      
    } catch (error) {
      console.error(`Erreur lors de l'action ${action}:`, error);
      alert(`Erreur lors de la mise à jour.`);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const name = t.members ? `${t.members.first_name} ${t.members.last_name}`.toLowerCase() : '';
    const matchesSearch = name.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Tous' || t.status === statusFilter || (statusFilter === 'Annulé' && t.status === 'Refusé');
    return matchesSearch && matchesStatus;
  });

  const countPending = transactions.filter(t => t.status === 'En attente').length;
  const countValidated = transactions.filter(t => t.status === 'Validé').length;
  const countCancelled = transactions.filter(t => t.status === 'Annulé' || t.status === 'Refusé').length;

  return (
    <div className="flex flex-col relative z-10 pb-40 md:pb-8">
      <div className="p-6 md:p-8 pb-4">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">
          Historique & Gestion des Cotisations
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium md:text-lg transition-colors">
          Suivez la traçabilité complète des cotisations : en attente, validées ou annulées.
        </p>
      </div>

      <div className="flex-1 px-4 md:px-8 max-w-5xl w-full mx-auto space-y-6">
        
        {/* Onglets de filtrage par Statut */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          <button
            onClick={() => setStatusFilter('En attente')}
            className={`whitespace-nowrap rounded-2xl px-5 py-2.5 text-sm font-black transition-all flex items-center gap-2 ${
              statusFilter === 'En attente'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-white/50 dark:border-slate-700/50 hover:bg-white'
            }`}
          >
            <Clock size={16} /> En attente ({countPending})
          </button>

          <button
            onClick={() => setStatusFilter('Validé')}
            className={`whitespace-nowrap rounded-2xl px-5 py-2.5 text-sm font-black transition-all flex items-center gap-2 ${
              statusFilter === 'Validé'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-white/50 dark:border-slate-700/50 hover:bg-white'
            }`}
          >
            <CheckCircle size={16} /> Validés ({countValidated})
          </button>

          <button
            onClick={() => setStatusFilter('Annulé')}
            className={`whitespace-nowrap rounded-2xl px-5 py-2.5 text-sm font-black transition-all flex items-center gap-2 ${
              statusFilter === 'Annulé'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-white/50 dark:border-slate-700/50 hover:bg-white'
            }`}
          >
            <XCircle size={16} /> Annulés ({countCancelled})
          </button>

          <button
            onClick={() => setStatusFilter('Tous')}
            className={`whitespace-nowrap rounded-2xl px-5 py-2.5 text-sm font-black transition-all ${
              statusFilter === 'Tous'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-white/50 dark:border-slate-700/50 hover:bg-white'
            }`}
          >
            Tous ({transactions.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex items-center rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/20 transition-all p-2">
          <Search size={20} className="ml-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher par nom de membre..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-transparent px-3 py-3 text-base font-medium text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400" 
          />
        </div>

        {/* Transactions List */}
        <div className="rounded-[32px] bg-white/60 dark:bg-slate-900/50 p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white/50 dark:border-slate-700/50 transition-all">
          
          {loading ? (
            <div className="flex justify-center p-10">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600/30 border-t-blue-600"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 shadow-inner">
                <CheckCircle size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Aucune transaction trouvée</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Aucune cotisation dans cette catégorie.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTransactions.map((t) => {
                const isPending = t.status === 'En attente';
                const isValidated = t.status === 'Validé';

                return (
                  <div key={t.id} className="group relative flex flex-col md:flex-row md:items-center justify-between p-5 md:p-6 rounded-[24px] bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/20 hover:shadow-xl transition-all duration-300 gap-6">
                    
                    {/* Info Section */}
                    <div className="flex items-start md:items-center gap-4 flex-1">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-inner border ${
                        isValidated
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50'
                          : isPending
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200/50'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200/50'
                      }`}>
                        {isValidated ? <CheckCircle size={28} /> : isPending ? <Clock size={28} /> : <XCircle size={28} />}
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-black text-slate-900 dark:text-white text-lg md:text-xl tracking-tight">
                          {t.members ? `${t.members.first_name} ${t.members.last_name}` : 'Membre Inconnu'}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-[#1DC4E9]">
                            {t.payment_method || 'Wave'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            Sass {t.sass_type || 'Général'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
                            {t.members?.sector || 'Secteur inconnu'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {new Date(t.payment_date).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions & Amount Section */}
                    <div className="flex flex-col items-start md:items-end gap-5 border-t md:border-t-0 border-slate-100 dark:border-slate-700/50 pt-5 md:pt-0 shrink-0 w-full md:w-auto">
                      
                      {/* Amount */}
                      <div className="flex flex-col items-start md:items-end justify-start w-full gap-1">
                        <div className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Montant</div>
                        <div className={`text-3xl font-black tracking-tight ${isValidated ? 'text-emerald-600 dark:text-emerald-400' : isPending ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                          {Number(t.amount).toLocaleString('fr-FR')} <span className="text-sm text-slate-400 font-bold ml-0.5">FCFA</span>
                        </div>
                      </div>
                      
                      {/* Buttons / Badges */}
                      {isPending ? (
                        <div className="flex items-center justify-between md:justify-end gap-3 w-full">
                          <button 
                            onClick={() => handleAction(t.id, 'Annulé')}
                            disabled={processingId === t.id}
                            className="flex-1 md:flex-none flex h-12 md:w-12 px-4 md:px-0 items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-colors disabled:opacity-50 group font-bold md:font-normal text-sm"
                            title="Annuler"
                          >
                            <XCircle size={22} className="group-hover:scale-110 transition-transform" />
                            <span className="md:hidden">Annuler</span>
                          </button>
                          
                          <button 
                            onClick={() => handleAction(t.id, 'Validé')}
                            disabled={processingId === t.id}
                            className="flex-1 md:flex-none flex h-12 px-6 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-600 hover:to-emerald-500 text-white font-black text-sm tracking-wide shadow-xl shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {processingId === t.id ? (
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                            ) : (
                              <>
                                <CheckCircle size={20} /> Valider
                              </>
                            )}
                          </button>
                        </div>
                      ) : isValidated ? (
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                          <CheckCircle size={16} /> Validé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300/40">
                          <XCircle size={16} /> {t.status || 'Annulé'}
                        </span>
                      )}

                    </div>
                    
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
