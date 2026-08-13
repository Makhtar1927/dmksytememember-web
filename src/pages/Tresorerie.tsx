import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, ArrowDownRight, ArrowUpRight, CheckCircle, X, PlusCircle, FileText, CalendarDays, Calendar as CalendarIcon, Moon, Star, Sparkles } from 'lucide-react';

const EXPENSE_REASONS = [
  'Achat Logistique', 'Location Sono/Matériel', 'Restauration / Alimentation',
  'Transport', 'Aumône (Hadiya)', 'Frais administratifs', 'Secours social', 
  'Magal', 'Gamou', 'Ziaar', 'Autre'
];

const INCOME_SOURCES = [
  'Barkelou', 'Bénéfices Projets/Événements', 'Dons Anonymes', 'Apport Extérieur', 'Autre'
];

export default function Tresorerie() {
  const [loading, setLoading] = useState(true);
  
  // Stats
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthEntries, setMonthEntries] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  
  // Data
  const [mixedTransactions, setMixedTransactions] = useState<any[]>([]);

  // Modal State - Décaissement
  const [isExpenseModalVisible, setExpenseModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState(EXPENSE_REASONS[0]);
  const [expenseBeneficiary, setExpenseBeneficiary] = useState('');

  // Modal State - Encaissement Général
  const [isIncomeModalVisible, setIncomeModalVisible] = useState(false);
  const [isIncomeSubmitting, setIsIncomeSubmitting] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState(INCOME_SOURCES[0]);
  const [incomeDesc, setIncomeDesc] = useState('');

  // Report State
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [reportType, setReportType] = useState<'hebdo'|'mensuel'|'Magal'|'Gamou'|'Ziaar'>('hebdo');

  useEffect(() => {
    fetchTreasuryData();

    // S'abonner aux changements en temps réel
    const channel = supabase.channel('treasury_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'treasury_incomes' }, () => {
        fetchTreasuryData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'treasury_expenses' }, () => {
        fetchTreasuryData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sass_contributions' }, () => {
        fetchTreasuryData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (isIncomeModalVisible || isExpenseModalVisible || isReportModalVisible) {
      document.body.classList.add('hide-bottom-nav');
    } else {
      document.body.classList.remove('hide-bottom-nav');
    }
    return () => {
      document.body.classList.remove('hide-bottom-nav');
    };
  }, [isIncomeModalVisible, isExpenseModalVisible, isReportModalVisible]);

  const fetchTreasuryData = async () => {
    setLoading(true);
    try {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const { data: summary, error: rpcError } = await supabase.rpc('get_treasury_summary', {
        target_month: currentMonth,
        target_year: currentYear
      });

      if (rpcError) {
        console.error("Erreur RPC:", rpcError);
        window.alert("Attention: Impossible de charger les totaux.");
      } else if (summary) {
        setTotalBalance(summary.total_balance || 0);
        setMonthEntries(summary.total_incomes || 0);
        setMonthExpenses(summary.total_expenses || 0);
      }

      const { data: contribs } = await supabase.from('sass_contributions').select('id, amount, payment_date, members:member_id(first_name, last_name, sector)').eq('status', 'Validé').order('payment_date', { ascending: false }).limit(15);
      const { data: expenses } = await supabase.from('treasury_expenses').select('*').order('expense_date', { ascending: false }).limit(15);
      const { data: incomes } = await supabase.from('treasury_incomes').select('*').order('income_date', { ascending: false }).limit(15);

      const history: any[] = [];
      
      if (contribs) {
        contribs.forEach(c => {
          history.push({
            id: 'sass_' + c.id,
            type: 'income',
            amount: c.amount,
            date: new Date(c.payment_date),
            title: c.members ? `${(c.members as any).first_name} ${(c.members as any).last_name}` : 'Membre Inconnu',
            subtitle: `Cotisation Sass • ${(c.members as any)?.sector || ''}`
          });
        });
      }

      if (incomes) {
        incomes.forEach(i => {
          history.push({
            id: 'gen_' + i.id,
            type: 'income',
            amount: i.amount,
            date: new Date(i.income_date),
            title: i.source,
            subtitle: `Revenu Libre • ${i.description || 'Sans description'}`
          });
        });
      }

      if (expenses) {
        expenses.forEach(e => {
          history.push({
            id: 'out_' + e.id,
            type: 'expense',
            amount: e.amount,
            date: new Date(e.expense_date),
            title: e.beneficiary,
            subtitle: `Décaissement • ${e.reason}`
          });
        });
      }

      history.sort((a, b) => b.date.getTime() - a.date.getTime());
      setMixedTransactions(history.slice(0, 15)); 

    } catch (error) {
      console.error("Erreur Trésorerie:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || isNaN(Number(expenseAmount)) || Number(expenseAmount) <= 0) return window.alert("Veuillez entrer un montant valide.");
    if (!expenseBeneficiary.trim()) return window.alert("Veuillez renseigner le bénéficiaire.");
    if (Number(expenseAmount) > totalBalance) return window.alert("Fonds insuffisants !");
    
    try {
      setIsSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload = { amount: Number(expenseAmount), reason: expenseReason, beneficiary: expenseBeneficiary.trim(), created_by: session?.user?.id };
      
      const { error } = await supabase.from('treasury_expenses').insert(payload);
      if (error) throw error;
      
      // LOG ACTIVITY
      await supabase.from('activity_logs').insert([{
        user_email: session?.user?.email || 'Inconnu',
        action_type: 'CRÉATION',
        entity_type: 'TRÉSORERIE',
        details: `Décaissement: ${expenseAmount} F pour ${expenseBeneficiary} (Motif: ${expenseReason})`,
        sector: 'N/A'
      }]);
      
      window.alert("Décaissement enregistré !");
      fetchTreasuryData();
      setExpenseModalVisible(false); 
      setExpenseAmount(''); 
      setExpenseBeneficiary(''); 
      setExpenseReason(EXPENSE_REASONS[0]);
    } catch (error) { 
      window.alert("Erreur décaissement."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleProcessIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeAmount || isNaN(Number(incomeAmount)) || Number(incomeAmount) <= 0) return window.alert("Veuillez entrer un montant valide.");
    
    try {
      setIsIncomeSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload = { amount: Number(incomeAmount), source: incomeSource, description: incomeDesc.trim() || null, created_by: session?.user?.id };
      
      const { error } = await supabase.from('treasury_incomes').insert(payload);
      if (error) throw error;
      
      // LOG ACTIVITY
      await supabase.from('activity_logs').insert([{
        user_email: session?.user?.email || 'Inconnu',
        action_type: 'CRÉATION',
        entity_type: 'TRÉSORERIE',
        details: `Encaissement: ${incomeAmount} F depuis ${incomeSource} (Ref: ${incomeDesc || 'Aucune'})`,
        sector: 'N/A'
      }]);
      
      window.alert("Encaissement enregistré !");
      fetchTreasuryData();
      setIncomeModalVisible(false); 
      setIncomeAmount(''); 
      setIncomeDesc(''); 
      setIncomeSource(INCOME_SOURCES[0]);
    } catch (error) { 
      window.alert("Erreur encaissement."); 
    } finally { 
      setIsIncomeSubmitting(false); 
    }
  };

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const generatePDF = async () => {
    if (isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      const isEventReport = reportType === 'Magal' || reportType === 'Gamou' || reportType === 'Ziaar';
      const title = isEventReport ? `Bilan des Dépenses - ${reportType}` : (reportType === 'hebdo' ? 'Bilan Hebdomadaire' : 'Bilan Mensuel');
      
      let startDateStr = '';
      let dateText = '';
      
      if (!isEventReport) {
        if (reportType === 'hebdo') {
          const d = new Date();
          const day = d.getDay();
          const diff = (day < 5 ? 7 : 0) + day - 5; 
          d.setDate(d.getDate() - diff);
          d.setHours(0, 0, 0, 0);
          startDateStr = d.toISOString();
          dateText = `Du ${d.toLocaleDateString('fr-FR')} à Aujourd'hui`;
        } else {
          const d = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          startDateStr = d.toISOString();
          dateText = `Mois de ${d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`;
        }
      } else {
        dateText = `Toutes les dépenses enregistrées pour le ${reportType}`;
      }

      let htmlContent = '';

      if (isEventReport) {
        const { data: expenses } = await supabase.from('treasury_expenses').select('*').eq('reason', reportType).order('expense_date', { ascending: false });
        const safeExpenses = expenses || [];

        let totalExp = 0;
        let expenseRows = '';
        safeExpenses.forEach(e => {
          totalExp += e.amount;
          const date = new Date(e.expense_date).toLocaleDateString('fr-FR');
          expenseRows += `<tr>
            <td>${date}</td>
            <td>${e.beneficiary}</td>
            <td style="text-align:right; font-weight:bold;">${e.amount.toLocaleString('fr-FR')} F</td>
          </tr>`;
        });

        htmlContent = `
          <html>
            <head>
              <title>${title}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
              <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1f2937; }
                .header { text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
                .title { font-size: 28px; font-weight: bold; color: #dc2626; margin: 0; }
                .subtitle { font-size: 16px; color: #6b7280; margin-top: 5px; }
                h2 { font-size: 22px; color: #1f2937; margin-bottom: 5px; }
                .date-text { color: #64748b; font-size: 14px; margin-bottom: 30px; }
                .summary-box { background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center; }
                .sum-label { font-size: 14px; color: #991b1b; text-transform: uppercase; letter-spacing: 1px; }
                .sum-val { font-size: 32px; font-weight: bold; margin-top: 10px; color: #dc2626; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { padding: 12px; border-bottom: 2px solid #fca5a5; background-color: #fef2f2; text-align: left; color: #991b1b; }
                td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af; }
                @media print { body { padding: 0; } }
              </style>
            </head>
            <body>
              <div class="header">
                <h1 class="title">Trésorerie Générale - DMK</h1>
                <p class="subtitle">Bilan des Décaissements Événementiels</p>
              </div>
              <h2>${title}</h2>
              <div class="date-text">${dateText}</div>
              <div class="summary-box">
                <div class="sum-label">Total des Dépenses de l'Événement</div>
                <div class="sum-val">${totalExp.toLocaleString('fr-FR')} FCFA</div>
              </div>
              ${totalExp > 0 ? `
                <table>
                  <thead><tr><th>Date</th><th>Bénéficiaire / Description</th><th style="text-align:right;">Montant</th></tr></thead>
                  <tbody>${expenseRows}</tbody>
                </table>
              ` : '<p style="text-align:center; color:#64748b; padding: 40px;">Aucune dépense enregistrée pour cet événement.</p>'}
              <div class="footer">
                Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
              </div>
              <script>
                window.onload = function() { window.print(); }
              </script>
            </body>
          </html>
        `;
      } else {
        const { data: contribs } = await supabase.from('sass_contributions').select('*, members:member_id(sector)').gte('payment_date', startDateStr).eq('status', 'Validé');
        const { data: genIncomes } = await supabase.from('treasury_incomes').select('*').gte('income_date', startDateStr);
        const { data: expenses } = await supabase.from('treasury_expenses').select('*').gte('expense_date', startDateStr);

        const safeContribs = contribs || [];
        const safeGenIncomes = genIncomes || [];
        const safeExpenses = expenses || [];

        const sectorsTotal: Record<string, number> = {};
        let totalSass = 0;
        safeContribs.forEach(c => {
          const sec = (c.members as any)?.sector || 'Inconnu';
          sectorsTotal[sec] = (sectorsTotal[sec] || 0) + c.amount;
          totalSass += c.amount;
        });

        const incomesTotal: Record<string, number> = {};
        let totalGenInc = 0;
        safeGenIncomes.forEach(c => {
          incomesTotal[c.source] = (incomesTotal[c.source] || 0) + c.amount;
          totalGenInc += c.amount;
        });

        const expensesTotal: Record<string, number> = {};
        let totalExp = 0;
        safeExpenses.forEach(e => {
          expensesTotal[e.reason] = (expensesTotal[e.reason] || 0) + e.amount;
          totalExp += e.amount;
        });

        const netBalance = (totalSass + totalGenInc) - totalExp;

        const sectorRows = Object.entries(sectorsTotal).map(([k, v]) => `<tr><td>Secteur ${k}</td><td style="text-align:right; font-weight:bold;">${v.toLocaleString('fr-FR')} F</td></tr>`).join('');
        const incomeRows = Object.entries(incomesTotal).map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right; font-weight:bold;">${v.toLocaleString('fr-FR')} F</td></tr>`).join('');
        const expenseRows = Object.entries(expensesTotal).map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right; font-weight:bold;">${v.toLocaleString('fr-FR')} F</td></tr>`).join('');

        htmlContent = `
          <html>
            <head>
              <title>${title}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
              <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1f2937; }
                .header { text-align: center; border-bottom: 2px solid #16a34a; padding-bottom: 20px; margin-bottom: 30px; }
                .title { font-size: 28px; font-weight: bold; color: #16a34a; margin: 0; }
                .subtitle { font-size: 16px; color: #6b7280; margin-top: 5px; }
                h2 { font-size: 22px; color: #1f2937; margin-bottom: 5px; }
                .date-text { color: #64748b; font-size: 14px; margin-bottom: 20px; }
                .summary-box { display: flex; justify-content: space-between; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
                .sum-item { text-align: center; width: 33%; }
                .sum-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                .sum-val { font-size: 24px; font-weight: bold; margin-top: 5px; }
                .val-in { color: #16a34a; }
                .val-out { color: #dc2626; }
                .val-net { color: #2563eb; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { padding: 10px; border-bottom: 2px solid #cbd5e1; background-color: #f1f5f9; text-align: left; }
                td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
                .table-title { font-size: 18px; font-weight: bold; color: #334155; border-bottom: 2px solid #94a3b8; padding-bottom: 5px; margin-bottom: 10px; margin-top: 20px; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af; }
                @media print { body { padding: 0; } }
              </style>
            </head>
            <body>
              <div class="header">
                <h1 class="title">Trésorerie Générale - DMK</h1>
                <p class="subtitle">Rapport Financier Officiel</p>
              </div>
              <h2>${title}</h2>
              <div class="date-text">Période : ${dateText}</div>
              <div class="summary-box">
                <div class="sum-item">
                  <div class="sum-label">Total Entrées</div>
                  <div class="sum-val val-in">+ ${(totalSass + totalGenInc).toLocaleString('fr-FR')} F</div>
                </div>
                <div class="sum-item">
                  <div class="sum-label">Total Sorties</div>
                  <div class="sum-val val-out">- ${totalExp.toLocaleString('fr-FR')} F</div>
                </div>
                <div class="sum-item" style="border-left: 1px solid #e2e8f0;">
                  <div class="sum-label">Solde Net</div>
                  <div class="sum-val val-net">${netBalance.toLocaleString('fr-FR')} F</div>
                </div>
              </div>
              ${totalSass > 0 ? `
                <div class="table-title">1. Cotisations Sass (Par Secteur)</div>
                <table>
                  <thead><tr><th>Secteur</th><th style="text-align:right;">Montant Collecté</th></tr></thead>
                  <tbody>${sectorRows}</tbody>
                </table>
              ` : ''}
              ${totalGenInc > 0 ? `
                <div class="table-title">2. Revenus Libres (Barkelou, Projets...)</div>
                <table>
                  <thead><tr><th>Catégorie</th><th style="text-align:right;">Montant</th></tr></thead>
                  <tbody>${incomeRows}</tbody>
                </table>
              ` : ''}
              ${totalExp > 0 ? `
                <div class="table-title">3. Décaissements (Dépenses)</div>
                <table>
                  <thead><tr><th>Motif</th><th style="text-align:right;">Montant</th></tr></thead>
                  <tbody>${expenseRows}</tbody>
                </table>
              ` : ''}
              ${(totalSass === 0 && totalGenInc === 0 && totalExp === 0) ? '<p style="text-align:center; color:#64748b; padding: 40px;">Aucune transaction durant cette période.</p>' : ''}
              <div class="footer">
                Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
              </div>
              <script>
                window.onload = function() { window.print(); }
              </script>
            </body>
          </html>
        `;
      }

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      } else {
        window.alert("Veuillez autoriser l'ouverture de pop-ups pour imprimer le rapport.");
      }
      setReportModalVisible(false);
    } catch (error) {
      console.error("Erreur PDF:", error);
      window.alert("Impossible de générer le rapport.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const formatMoney = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) return "0";
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };
  
  const formatDate = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading && mixedTransactions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center relative z-10">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600/30 border-t-blue-600 drop-shadow-md"></div>
      </div>
    );
  }

  const getReportDescription = () => {
    if (reportType === 'hebdo') return "Du dernier Vendredi à Aujourd'hui";
    if (reportType === 'mensuel') return "Mois en cours";
    return `Toutes les dépenses du ${reportType}`;
  };

  return (
    <div className="flex flex-col relative z-10 pb-40 md:pb-8">
      <div className="p-6 md:p-8 pb-4">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Trésorerie</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium md:text-lg transition-colors">Supervision Financière</p>
      </div>

      <div className="flex-1 px-4 md:px-8 max-w-4xl w-full mx-auto space-y-8">
        
        {/* SOLDE GLOBAL */}
        <div className="rounded-[32px] bg-gradient-to-br from-slate-800 to-slate-950 dark:from-slate-900 dark:to-black p-6 md:p-8 shadow-xl shadow-slate-900/20 text-white relative overflow-hidden transition-all hover:shadow-2xl border border-slate-700/50">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
          
          <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2 relative z-10">Solde Global Caisse Réel</p>
          <div className="text-4xl md:text-5xl font-black tracking-tight mb-4 relative z-10 drop-shadow-sm">
            {formatMoney(totalBalance)} <span className="text-xl text-slate-400 opacity-80">FCFA</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1.5 border border-slate-700/50 relative z-10 shadow-inner">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs font-bold text-green-300">Synchronisé en temps réel</span>
          </div>
        </div>

        {/* STATS DU MOIS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-6 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 shadow-inner group-hover:scale-110 transition-transform">
              <ArrowDownRight size={26} />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 transition-colors">Total Encaissements</p>
            <p className="text-2xl font-black text-green-600 dark:text-green-400 transition-colors">+{formatMoney(monthEntries)}</p>
          </div>
          <div className="rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-6 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 shadow-inner group-hover:scale-110 transition-transform">
              <ArrowUpRight size={26} />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 transition-colors">Total Décaissements</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400 transition-colors">-{formatMoney(monthExpenses)}</p>
          </div>
        </div>

        {/* GESTION COURANTE */}
        <div>
          <h2 className="mb-5 ml-2 text-xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Gestion Courante</h2>
          <div className="space-y-3">
            <button 
              onClick={() => setIncomeModalVisible(true)}
              className="flex w-full items-center gap-4 rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-5 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 shadow-inner group-hover:scale-110 transition-transform">
                <PlusCircle size={30} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-slate-900 dark:text-white transition-colors">Nouvel Encaissement</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">Barkelou, Bénéfices, Dons, etc.</p>
              </div>
            </button>
            
            <button 
              onClick={() => setExpenseModalVisible(true)}
              className="flex w-full items-center gap-4 rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-5 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 shadow-inner group-hover:scale-110 transition-transform">
                <DollarSign size={30} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-slate-900 dark:text-white transition-colors">Nouveau Décaissement</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">Enregistrer une sortie de caisse</p>
              </div>
            </button>
          </div>
        </div>

        {/* RAPPORTS PERIODIQUES */}
        <div>
          <h2 className="mb-5 ml-2 text-xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Rapports Périodiques</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => { setReportType('hebdo'); setReportModalVisible(true); }}
              className="flex-1 flex items-center justify-center gap-3 rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-5 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 group"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-inner group-hover:scale-110 transition-transform">
                <CalendarDays size={24} />
              </div>
              <span className="font-black text-slate-900 dark:text-white text-base transition-colors">Bilan Hebdo</span>
            </button>
            <button 
              onClick={() => { setReportType('mensuel'); setReportModalVisible(true); }}
              className="flex-1 flex items-center justify-center gap-3 rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-5 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl hover:bg-amber-50/50 dark:hover:bg-amber-900/20 group"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-inner group-hover:scale-110 transition-transform">
                <CalendarIcon size={24} />
              </div>
              <span className="font-black text-slate-900 dark:text-white text-base transition-colors">Bilan Mensuel</span>
            </button>
          </div>
        </div>

        {/* RAPPORTS EVENEMENTIELS */}
        <div>
          <h2 className="mb-5 ml-2 text-xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Rapports Événementiels</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => { setReportType('Magal'); setReportModalVisible(true); }} className="flex-1 rounded-[24px] border border-white/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/50 p-5 text-center shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 transition-all hover:-translate-y-1 hover:shadow-xl hover:border-amber-200/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 group">
              <Star size={28} className="mx-auto mb-3 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform drop-shadow-sm" />
              <span className="text-base font-black text-slate-700 dark:text-slate-300 transition-colors">Magal</span>
            </button>
            <button onClick={() => { setReportType('Gamou'); setReportModalVisible(true); }} className="flex-1 rounded-[24px] border border-white/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/50 p-5 text-center shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 transition-all hover:-translate-y-1 hover:shadow-xl hover:border-indigo-200/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 group">
              <Moon size={28} className="mx-auto mb-3 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform drop-shadow-sm" />
              <span className="text-base font-black text-slate-700 dark:text-slate-300 transition-colors">Gamou</span>
            </button>
            <button onClick={() => { setReportType('Ziaar'); setReportModalVisible(true); }} className="flex-1 rounded-[24px] border border-white/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/50 p-5 text-center shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 transition-all hover:-translate-y-1 hover:shadow-xl hover:border-emerald-200/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 group">
              <Sparkles size={28} className="mx-auto mb-3 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform drop-shadow-sm" />
              <span className="text-base font-black text-slate-700 dark:text-slate-300 transition-colors">Ziaar</span>
            </button>
          </div>
        </div>

        {/* HISTORIQUE OPERATIONS */}
        <div>
          <h2 className="mb-5 ml-2 text-xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Dernières Opérations</h2>
          {mixedTransactions.length === 0 ? (
            <div className="rounded-[32px] border-2 border-dashed border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 p-10 text-center font-bold text-slate-500 dark:text-slate-400 transition-colors">
              Aucune opération enregistrée.
            </div>
          ) : (
            <div className="space-y-3">
              {mixedTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-5 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:bg-white/80 dark:hover:bg-slate-800/50 hover:shadow-xl">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] shadow-inner ${tx.type === 'income' ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                    {tx.type === 'income' ? <ArrowDownRight size={26} /> : <ArrowUpRight size={26} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-900 dark:text-white truncate text-base transition-colors">{tx.title}</h4>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate mt-1 tracking-wide transition-colors">
                      {formatDate(tx.date)} • {tx.subtitle}
                    </p>
                  </div>
                  <div className={`text-right font-black whitespace-nowrap text-lg ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} transition-colors`}>
                    {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL ENCAISSEMENT */}
      {isIncomeModalVisible && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-black/60 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full sm:max-w-md bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 p-6 pb-4">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Encaissement Libre</h3>
              <button onClick={() => setIncomeModalVisible(false)} className="rounded-full bg-slate-100/50 dark:bg-slate-800/50 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleProcessIncome} className="p-6 pt-4 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Montant reçu (FCFA)</label>
                <input type="number" required value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} placeholder="Ex: 25000" className="w-full rounded-2xl border border-emerald-200/50 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-900/20 px-4 py-4 text-center text-3xl font-black text-emerald-700 dark:text-emerald-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 placeholder:text-emerald-300 dark:placeholder:text-emerald-700 transition-all shadow-inner" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 ml-1">Source des fonds</label>
                <div className="flex flex-wrap gap-2">
                  {INCOME_SOURCES.map(source => (
                    <button
                      key={source} type="button"
                      onClick={() => setIncomeSource(source)}
                      className={`rounded-full px-4 py-2.5 text-sm font-bold transition-all border ${
                        incomeSource === source 
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' 
                          : 'border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/50 hover:shadow-sm'
                      }`}
                    >
                      {source}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Description (Optionnel)</label>
                <input type="text" value={incomeDesc} onChange={e => setIncomeDesc(e.target.value)} placeholder="Ex: Vente de 5 calendriers" className="w-full rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 px-4 py-4 text-base font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all" />
              </div>

              <button 
                type="submit"
                disabled={isIncomeSubmitting}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-base font-bold text-white shadow-xl shadow-emerald-600/30 transition-all hover:bg-emerald-700 disabled:opacity-70 active:scale-95"
              >
                {isIncomeSubmitting ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div> : <CheckCircle size={20} />}
                {isIncomeSubmitting ? 'Traitement...' : 'Valider l\'entrée'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DECAISSEMENT */}
      {isExpenseModalVisible && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-black/60 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full sm:max-w-md bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 p-6 pb-4">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Nouveau Décaissement</h3>
              <button onClick={() => setExpenseModalVisible(false)} className="rounded-full bg-slate-100/50 dark:bg-slate-800/50 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleProcessExpense} className="p-6 pt-4 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Montant à retirer (FCFA)</label>
                <input type="number" required value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Ex: 50000" className="w-full rounded-2xl border border-red-200/50 dark:border-red-500/30 bg-red-50/50 dark:bg-red-900/20 px-4 py-4 text-center text-3xl font-black text-red-700 dark:text-red-400 focus:border-red-500 focus:outline-none focus:ring-4 focus:ring-red-500/20 placeholder:text-red-300 dark:placeholder:text-red-700 transition-all shadow-inner" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 ml-1">Motif de la dépense</label>
                <div className="flex flex-wrap gap-2">
                  {EXPENSE_REASONS.map(reason => (
                    <button
                      key={reason} type="button"
                      onClick={() => setExpenseReason(reason)}
                      className={`rounded-full px-4 py-2.5 text-sm font-bold transition-all border ${
                        expenseReason === reason 
                          ? 'border-red-600 bg-red-600 text-white shadow-lg shadow-red-600/30' 
                          : 'border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/50 hover:shadow-sm'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Bénéficiaire (Nom / Structure)</label>
                <input type="text" required value={expenseBeneficiary} onChange={e => setExpenseBeneficiary(e.target.value)} placeholder="Ex: Abdoulaye Ndiaye (Transport)" className="w-full rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 px-4 py-4 text-base font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all" />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-4 text-base font-bold text-white shadow-xl shadow-red-600/30 transition-all hover:bg-red-700 disabled:opacity-70 active:scale-95"
              >
                {isSubmitting ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div> : <CheckCircle size={20} />}
                {isSubmitting ? 'Traitement...' : 'Valider la sortie'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RAPPORTS VISUEL */}
      {isReportModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700/50 rounded-[32px] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Rapport {reportType}</h3>
              <button onClick={() => setReportModalVisible(false)} className="rounded-full bg-slate-100/50 dark:bg-slate-800/50 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="rounded-2xl border-2 border-dashed border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 p-6 text-center mb-6 shadow-inner">
              <FileText size={48} className="mx-auto mb-4 text-slate-400 dark:text-slate-500 drop-shadow-sm" />
              <p className="font-black text-slate-700 dark:text-slate-200">Aperçu du Document</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">{getReportDescription()}</p>
              
              <div className="mt-5 pt-4 border-t border-slate-200/50 dark:border-slate-700/50 text-left space-y-3">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">Contenu:</span>
                  <span className="font-black text-slate-700 dark:text-slate-300 text-right">{(reportType === 'Magal' || reportType === 'Gamou' || reportType === 'Ziaar') ? 'Dépenses Uniquement' : 'Sass, Recettes, Dépenses'}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">Format:</span>
                  <span className="font-black text-slate-700 dark:text-slate-300">Impression web PDF</span>
                </div>
              </div>
            </div>

            <button 
              onClick={generatePDF}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-bold text-white transition-all shadow-xl shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-600/40 active:scale-95"
            >
              <FileText size={20} /> Imprimer / Sauvegarder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
