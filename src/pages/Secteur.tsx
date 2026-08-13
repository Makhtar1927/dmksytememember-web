import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Map, Wallet, Calendar, Bell, X, CheckCircle, Search, CalendarDays, FileText, ScanLine } from 'lucide-react';
import { QRCode } from 'react-qr-code';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  sector: string;
  role?: string;
  status?: string;
  email?: string;
  sass_magal?: number;
  sass_ziaar?: number;
  sass_kst?: number;
  sass_cahier?: number;
  sass_projets?: number;
  sass_autres?: number;
}

interface Contribution {
  id: string;
  member_id: string;
  amount: number;
  payment_date: string;
  status: string;
  sass_type?: string;
}

export default function Secteur() {
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<Member | null>(null);
  const [sectorMembers, setSectorMembers] = useState<Member[]>([]);
  const [lateMembers, setLateMembers] = useState<Member[]>([]);
  const [sectorStats, setSectorStats] = useState({ collected: 0, goal: 0, percent: 0 });
  
  // Modal States
  const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [isRemindModalVisible, setRemindModalVisible] = useState(false);
  const [isMemberModalVisible, setIsMemberModalVisible] = useState(false);
  const [reportType, setReportType] = useState<'hebdo'|'mensuel'>('hebdo');
  
  // Member Details State
  const [selectedMemberDetails, setSelectedMemberDetails] = useState<Member | null>(null);
  const [memberContributions, setMemberContributions] = useState<Contribution[]>([]);
  const [loadingMemberDetails, setLoadingMemberDetails] = useState(false);
  
  // Payment Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedSassType, setSelectedSassType] = useState('Magal/Gamou');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reminders State
  const [selectedReminders, setSelectedReminders] = useState<string[]>([]);
  const [isSendingReminders, setIsSendingReminders] = useState(false);

  const fetchSectorData = useCallback(async () => {
    await Promise.resolve();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) return;

      const { data: profileData, error: profileError } = await supabase
        .from('members')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (profileError) throw profileError;
      const profile = profileData as Member;
      setUserProfile(profile);

      if (profile && profile.sector) {
        const { data: membersData, error: membersError } = await supabase
          .from('members')
          .select('*')
          .eq('sector', profile.sector)
          .order('first_name', { ascending: true });
          
        if (membersError) throw membersError;
        const membersList = (membersData || []) as Member[];
        setSectorMembers(membersList);

        let totalGoal = 0;
        membersList.forEach((m) => {
           totalGoal += (m.sass_magal || 0) + (m.sass_ziaar || 0) + (m.sass_kst || 0) + (m.sass_cahier || 0) + (m.sass_projets || 0) + (m.sass_autres || 0);
        });

        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const memberIds = membersList.map((m) => m.id);
        
        let totalCollected = 0;
        let contribs: Contribution[] = [];
        
        if (memberIds.length > 0) {
          const { data: contribsData } = await supabase
            .from('sass_contributions')
            .select('amount, member_id')
            .in('member_id', memberIds)
            .gte('payment_date', startOfMonth)
            .eq('status', 'Validé');
            
          if (contribsData) {
            contribs = contribsData as Contribution[];
            totalCollected = contribs.reduce((sum, c) => sum + c.amount, 0);
          }
        }

        const pct = totalGoal > 0 ? Math.min(100, Math.round((totalCollected / totalGoal) * 100)) : 0;
        setSectorStats({ collected: totalCollected, goal: totalGoal, percent: pct });

        const lateList = membersList.filter((m) => {
          const memberContribs = contribs.filter(c => c.member_id === m.id);
          const memberTotalPaid = memberContribs.reduce((sum, c) => sum + c.amount, 0);
          return memberTotalPaid === 0;
        });
        setLateMembers(lateList);
      }
    } catch (error) {
      console.error("Erreur chargement données secteur:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSectorData();

    const channel = supabase
      .channel('secteur_member_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => fetchSectorData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sass_contributions' }, () => fetchSectorData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchSectorData]);

  useEffect(() => {
    if (isPaymentModalVisible || isReportModalVisible || isRemindModalVisible || isMemberModalVisible) {
      document.body.classList.add('hide-bottom-nav');
    } else {
      document.body.classList.remove('hide-bottom-nav');
    }
    return () => {
      document.body.classList.remove('hide-bottom-nav');
    };
  }, [isPaymentModalVisible, isReportModalVisible, isRemindModalVisible, isMemberModalVisible]);

  const handleMemberClick = async (member: Member) => {
    setSelectedMemberDetails(member);
    setIsMemberModalVisible(true);
    setLoadingMemberDetails(true);
    try {
      const { data, error } = await supabase
        .from('sass_contributions')
        .select('*')
        .eq('member_id', member.id)
        .eq('status', 'Validé');
      
      if (error) throw error;
      setMemberContributions((data || []) as Contribution[]);
    } catch (error) {
      console.error("Erreur chargement paiements membre:", error);
    } finally {
      setLoadingMemberDetails(false);
    }
  };

  const handleProcessPayment = async () => {
    const amountVal = parseFloat(paymentAmount);
    if (!selectedMemberId || !paymentAmount || isNaN(amountVal) || amountVal <= 0) {
      window.alert("Veuillez sélectionner un membre et saisir un montant valide (supérieur à 0).");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        member_id: selectedMemberId,
        amount: parseFloat(paymentAmount),
        payment_method: 'Espèces',
        sass_type: selectedSassType,
        status: 'Validé',
        payment_date: new Date().toISOString()
      };

      const { error } = await supabase.from('sass_contributions').insert([payload]);
      if (error) throw error;
      
      // LOG ACTIVITY
      const memberInfo = sectorMembers.find(m => m.id === selectedMemberId);
      const memberName = memberInfo ? `${memberInfo.first_name} ${memberInfo.last_name}` : selectedMemberId;
      await supabase.from('activity_logs').insert([{
        user_email: userProfile?.email || 'Inconnu',
        action_type: 'CRÉATION',
        entity_type: 'TRÉSORERIE',
        details: `Encaissement Sass (${selectedSassType}): ${paymentAmount} F pour ${memberName}`,
        sector: userProfile?.sector || 'N/A'
      }]);

      window.alert("Cotisation enregistrée avec succès !");
      fetchSectorData();
      
      setPaymentModalVisible(false);
      setPaymentAmount('');
      setSelectedMemberId('');
    } catch (error) {
      console.error("Erreur cotisation:", error);
      window.alert("Erreur lors de l'enregistrement de la cotisation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReminders = async () => {
    if (selectedReminders.length === 0) {
      window.alert("Veuillez sélectionner au moins un membre à relancer.");
      return;
    }

    setIsSendingReminders(true);
    try {
      const payloads = selectedReminders.map(id => {
        const member = sectorMembers.find(m => m.id === id);
        return {
          title: "Rappel de Cotisation Sass",
          content: `Salam ${member?.first_name}, ceci est un rappel amical du Dahira DMK. Votre cotisation Sass pour le secteur ${sectorName} est en attente. Merci de régulariser votre situation.`,
          type: 'Push Mobile',
          target_audience: 'Retardataires',
          status: 'Envoyé',
          recipient_id: id
        };
      });

      const { error } = await supabase.from('communications').insert(payloads);
      if (error) throw error;

      window.alert("Les relances ont été envoyées avec succès !");
      setRemindModalVisible(false);
      setSelectedReminders([]);
    } catch (error) {
      console.error("Erreur envoi relance:", error);
      window.alert("Erreur lors de l'envoi des relances.");
    } finally {
      setIsSendingReminders(false);
    }
  };

  const toggleReminderSelection = (id: string) => {
    if (selectedReminders.includes(id)) {
      setSelectedReminders(selectedReminders.filter(rId => rId !== id));
    } else {
      setSelectedReminders([...selectedReminders, id]);
    }
  };

  const selectAllReminders = () => {
    if (selectedReminders.length === lateMembers.length) {
      setSelectedReminders([]);
    } else {
      setSelectedReminders(lateMembers.map(m => m.id));
    }
  };

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const generatePDF = async () => {
    if (isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      const title = reportType === 'hebdo' ? 'Rapport Hebdomadaire' : 'Rapport Mensuel';
      const dateText = reportType === 'hebdo' ? "Du Vendredi passé à Aujourd'hui" : "Mois en cours";
      
      const startDate = reportType === 'hebdo' 
        ? new Date(new Date().setDate(new Date().getDate() - 7)).toISOString() 
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const memberIds = sectorMembers.map(m => m.id);
      
      let contributions: Contribution[] = [];
      if (memberIds.length > 0) {
        const { data, error } = await supabase
          .from('sass_contributions')
          .select('*')
          .in('member_id', memberIds)
          .gte('payment_date', startDate)
          .eq('status', 'Validé')
          .order('payment_date', { ascending: false });
          
        if (error) throw error;
        contributions = (data || []) as Contribution[];
      }

      let totalAmount = 0;
      const totalsByType: Record<string, number> = {};
      let tableRows = '';

      if (contributions.length > 0) {
        contributions.forEach(c => {
          totalAmount += c.amount;
          const sType = c.sass_type || 'Général';
          totalsByType[sType] = (totalsByType[sType] || 0) + c.amount;
          
          const member = sectorMembers.find(m => m.id === c.member_id);
          const memberName = member ? `${member.first_name} ${member.last_name}` : 'Inconnu';
          const date = new Date(c.payment_date).toLocaleDateString('fr-FR');
          
          tableRows += `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${date}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${memberName}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${sType}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight:bold;">${c.amount} F</td>
            </tr>
          `;
        });
      } else {
        tableRows = `<tr><td colspan="4" style="padding: 8px; text-align: center;">Aucune transaction pour cette période.</td></tr>`;
      }

      const typeSummaryRows = Object.entries(totalsByType)
        .filter(([, amount]) => amount > 0)
        .map(([type, amount]) => `
          <div class="row">
            <span class="label">Sass ${type}</span>
            <span class="value">${amount.toLocaleString('fr-FR')} FCFA</span>
          </div>
        `).join('');

      const sectorName = userProfile?.sector || "Secteur Non Défini";
      const htmlContent = `
        <html>
          <head>
            <title>${title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1f2937; }
              .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
              .title { font-size: 28px; font-weight: bold; color: #2563eb; margin: 0; }
              .subtitle { font-size: 16px; color: #6b7280; margin-top: 5px; }
              .info-box { background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
              .row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
              .row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
              .label { font-weight: bold; color: #4b5563; }
              .value { font-size: 18px; font-weight: bold; }
              .value.success { color: #16a34a; }
              .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af; }
              table { width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 30px; }
              th { padding: 8px; border-bottom: 2px solid #cbd5e1; background-color: #f3f4f6; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 class="title">Dahira DMK</h1>
              <p class="subtitle">Bureau Administratif et Financier</p>
            </div>
            
            <h2>${title} - Secteur ${sectorName}</h2>
            <p><strong>Dieuwrigne :</strong> ${userProfile?.first_name} ${userProfile?.last_name}</p>
            <p><strong>Période :</strong> ${dateText}</p>
            
            <div class="info-box">
              <div class="row">
                <span class="label">Membres Actifs (Commission)</span>
                <span class="value">${sectorMembers.length}</span>
              </div>
              <div class="row">
                <span class="label">Total Global Collecté</span>
                <span class="value success">${totalAmount.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>

            ${typeSummaryRows ? `
            <h3>Détails par Rubrique</h3>
            <div class="info-box" style="background-color: #f8fafc; border: 1px solid #e2e8f0;">
              ${typeSummaryRows}
            </div>
            ` : ''}
            
            <h3>Historique des Encaissements</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Membre</th>
                  <th>Catégorie</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            
            <p style="margin-top: 40px; font-size: 12px;"><em>Ce document est généré automatiquement par le Système d'Information DMK.</em></p>
            
            <div class="footer">
              Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
            </div>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `;

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

  if (loading && sectorMembers.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center relative z-10">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600/30 border-t-blue-600 drop-shadow-md"></div>
      </div>
    );
  }

  const sectorName = userProfile?.sector || "Secteur Non Défini";
  const filteredMembersForPayment = sectorMembers.filter(m => 
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );


  return (
    <div className="flex flex-col relative z-10 pb-40 md:pb-8">
      <div className="p-6 md:p-8 pb-4">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">{sectorName}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium md:text-lg transition-colors">Dieuwrigne Darou : {userProfile?.first_name} {userProfile?.last_name}</p>
      </div>

      <div className="flex-1 px-4 md:px-8 max-w-4xl w-full mx-auto space-y-8">
        {/* OVERVIEW CARD */}
        <div className="rounded-[32px] bg-gradient-to-br from-blue-600 to-blue-800 p-6 md:p-8 shadow-xl shadow-blue-600/30 text-white relative overflow-hidden transition-all hover:shadow-2xl hover:shadow-blue-600/40">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl animate-pulse"></div>
          <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-blue-400/20 blur-2xl"></div>
          
          <div className="mb-6 flex items-center gap-3 relative z-10">
            <Map size={24} className="text-blue-200" />
            <h2 className="text-lg font-bold">Aperçu Global (Mois en cours)</h2>
          </div>
          
          <div className="mb-2 text-4xl md:text-5xl font-black tracking-tight relative z-10 drop-shadow-sm">
            {(sectorStats.collected || 0).toLocaleString('fr-FR')} <span className="text-2xl text-blue-200 opacity-80">FCFA</span>
          </div>
          <p className="mb-8 text-blue-100 font-medium relative z-10">Collecté ce mois-ci sur un objectif de {(sectorStats.goal || 0).toLocaleString('fr-FR')} FCFA</p>
          
          <div className="relative z-10">
            <div className="mb-2 flex justify-between text-sm font-bold">
              <span className="text-blue-100">Progression</span>
              <span className="text-white drop-shadow-sm">{sectorStats.percent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-900/50 shadow-inner">
              <div className="h-full rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all duration-1000 relative overflow-hidden" style={{ width: `${sectorStats.percent}%` }}>
                 <div className="absolute inset-0 bg-white/50 w-full animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* QR CODE SECTION */}
        <div className="flex flex-col items-center justify-center p-8 bg-white/60 dark:bg-slate-900/50 border-2 border-dashed border-blue-400/50 rounded-[32px] shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 transition-all duration-300 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 group">
          <div className="flex items-center gap-2 mb-6">
            <ScanLine className="text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors" size={20} />
            <p className="text-sm text-slate-600 dark:text-slate-300 font-bold text-center transition-colors">
              Scannez ce QR code avec Wave
            </p>
          </div>
          
          <div className="p-5 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 group-hover:scale-105 transition-transform duration-500">
            <QRCode 
              value="https://pay.wave.com/m/M_sn_2MOwdjUaQWQJ/c/sn/" 
              size={180}
              className="qr-code-style"
              fgColor="#0f172a"
            />
          </div>
        </div>

        {/* ACTIONS RAPIDES */}
        <div>
          <h2 className="mb-5 ml-2 text-xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Actions Rapides</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => setPaymentModalVisible(true)} className="flex flex-col items-center justify-center rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-6 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 shadow-inner group-hover:scale-110 transition-transform">
                <Wallet size={26} />
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 text-center transition-colors">Encaisser<br/>Sass</span>
            </button>
            
            <button onClick={() => { setReportType('hebdo'); setReportModalVisible(true); }} className="flex flex-col items-center justify-center rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-6 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-inner group-hover:scale-110 transition-transform">
                <CalendarDays size={26} />
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 text-center transition-colors">Rapport<br/>Hebdo</span>
            </button>

            <button onClick={() => { setReportType('mensuel'); setReportModalVisible(true); }} className="flex flex-col items-center justify-center rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-6 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-inner group-hover:scale-110 transition-transform">
                <Calendar size={26} />
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 text-center transition-colors">Rapport<br/>Mensuel</span>
            </button>

            <button onClick={() => setRemindModalVisible(true)} className="relative flex flex-col items-center justify-center rounded-[24px] bg-white/60 dark:bg-slate-900/50 p-6 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 shadow-inner group-hover:scale-110 transition-transform relative">
                <Bell size={26} />
                {lateMembers.length > 0 && (
                  <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-slate-800 bg-red-500 text-[10px] font-black text-white shadow-sm animate-bounce">
                    {lateMembers.length}
                  </div>
                )}
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 text-center transition-colors">Relancer<br/>Retards</span>
            </button>
          </div>
        </div>

        {/* LISTE DES MEMBRES */}
        <div>
          <h2 className="mb-5 ml-2 text-xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Membres de la Commission ({sectorMembers.length})</h2>
          <div className="rounded-[32px] border border-white/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/50 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 transition-colors">
            {sectorMembers.length === 0 ? (
              <div className="p-10 text-center text-slate-500 dark:text-slate-400 font-medium">Aucun membre enregistré dans ce secteur.</div>
            ) : (
              <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
                {sectorMembers.map((member) => (
                  <div 
                    key={member.id} 
                    onClick={() => handleMemberClick(member)}
                    className="flex items-center p-4 md:p-5 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors duration-300 cursor-pointer"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-slate-100/50 dark:bg-slate-800/50 text-xl font-black text-slate-600 dark:text-slate-300 mr-5 shadow-inner border border-slate-200/50 dark:border-slate-700/50">
                      {member.first_name?.charAt(0) || 'M'}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-slate-900 dark:text-white text-base tracking-wide transition-colors">{member.first_name} {member.last_name}</div>
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 tracking-wider uppercase transition-colors">{member.role} • {member.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL : ENCAISSEMENT */}
      {isPaymentModalVisible && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-black/60 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full sm:max-w-md bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 p-6 pb-4">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Nouvelle Cotisation</h3>
              <button 
                onClick={() => setPaymentModalVisible(false)} 
                className="rounded-full bg-slate-100/50 dark:bg-slate-800/50 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Fermer"
                title="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 pt-4 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Rechercher le membre</label>
                <div className="relative flex items-center rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-4 focus-within:ring-blue-500/20 transition-all">
                  <Search size={20} className="ml-4 text-slate-400 dark:text-slate-500" />
                  <input type="text" placeholder="Rechercher par nom..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-transparent px-3 py-3.5 text-base font-medium text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                </div>
                
                <div className="mt-3 max-h-40 overflow-y-auto rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 custom-scrollbar">
                  {filteredMembersForPayment.map(m => (
                    <button 
                      key={m.id} 
                      onClick={() => setSelectedMemberId(m.id)}
                      className={`w-full flex items-center justify-between p-3.5 text-left transition-colors border-b border-slate-200/50 dark:border-slate-700/50 last:border-0 ${selectedMemberId === m.id ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/50 font-medium'}`}
                    >
                      {m.first_name} {m.last_name}
                      {selectedMemberId === m.id && <CheckCircle size={18} />}
                    </button>
                  ))}
                  {filteredMembersForPayment.length === 0 && (
                    <div className="p-4 text-center text-sm font-bold text-slate-500 dark:text-slate-400">Aucun membre trouvé.</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Catégorie (Sass)</label>
                <div className="flex flex-wrap gap-2">
                  {['Magal/Gamou', 'Ziaar', 'Keur Serigne Touba', 'Cahier Serigne Mountakha', 'Projets', 'Autres'].map(sass => (
                    <button
                      key={sass}
                      onClick={() => setSelectedSassType(sass)}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition-all border ${
                        selectedSassType === sass 
                          ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                          : 'border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/50 hover:shadow-sm'
                      }`}
                    >
                      Sass {sass}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Montant (FCFA)</label>
                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Ex: 5000" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 px-4 py-4 text-xl font-black text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </div>

              <button 
                onClick={handleProcessPayment}
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-bold text-white shadow-xl shadow-blue-600/30 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 disabled:opacity-70 mt-6 active:scale-95"
              >
                {isSubmitting ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div> : <CheckCircle size={20} />}
                {isSubmitting ? 'Traitement...' : 'Valider la cotisation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL : RELANCE DES RETARDS */}
      {isRemindModalVisible && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-black/60 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full sm:max-w-md bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 p-6 pb-4">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Relancer les Retards</h3>
              <button 
                onClick={() => setRemindModalVisible(false)} 
                className="rounded-full bg-slate-100/50 dark:bg-slate-800/50 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Fermer"
                title="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 pt-4">
              <div className="rounded-2xl border border-amber-200/50 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-900/20 p-4 mb-6 shadow-inner">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
                  <span className="font-black">Message Auto :</span> "Salam [Prénom], ceci est un rappel amical du Dahira DMK. Votre cotisation Sass pour le secteur {sectorName} est en attente. Merci de régulariser votre situation."
                </p>
              </div>

              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Membres en retard ({lateMembers.length})</label>
                <button onClick={selectAllReminders} className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                  {selectedReminders.length === lateMembers.length ? 'Désélectionner' : 'Sélectionner Tout'}
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 mb-6 custom-scrollbar">
                {lateMembers.map(m => {
                  const isSelected = selectedReminders.includes(m.id);
                  return (
                    <button 
                      key={m.id} 
                      onClick={() => toggleReminderSelection(m.id)}
                      className={`w-full flex items-center justify-between p-4 text-left transition-colors border-b border-slate-200/50 dark:border-slate-700/50 last:border-0 ${isSelected ? 'bg-white dark:bg-slate-800' : 'hover:bg-white/80 dark:hover:bg-slate-700/50'}`}
                    >
                      <span className={`font-medium transition-colors ${isSelected ? 'text-slate-900 dark:text-white font-black' : 'text-slate-700 dark:text-slate-300'}`}>
                        {m.first_name} {m.last_name}
                      </span>
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {isSelected && <CheckCircle size={14} />}
                      </div>
                    </button>
                  );
                })}
                {lateMembers.length === 0 && (
                  <div className="p-8 text-center text-emerald-600 dark:text-emerald-400 font-black">
                    Félicitations ! Tous les membres sont à jour.
                  </div>
                )}
              </div>

              <button 
                onClick={handleSendReminders}
                disabled={isSendingReminders || lateMembers.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-4 text-base font-bold text-white shadow-xl shadow-red-600/30 transition-all hover:bg-red-700 disabled:opacity-50 disabled:shadow-none active:scale-95"
              >
                <Bell size={20} />
                {isSendingReminders ? 'Envoi en cours...' : `Relancer ${selectedReminders.length} membre(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL : RAPPORTS (VISUEL WEB SIMPLE) */}
      {isReportModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700/50 rounded-[32px] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Rapport {reportType === 'hebdo' ? 'Hebdo' : 'Mensuel'}</h3>
              <button 
                onClick={() => setReportModalVisible(false)} 
                className="rounded-full bg-slate-100/50 dark:bg-slate-800/50 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Fermer"
                title="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="rounded-2xl border-2 border-dashed border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 p-6 text-center mb-6 shadow-inner">
              <FileText size={48} className="mx-auto mb-4 text-slate-400 dark:text-slate-500 drop-shadow-sm" />
              <p className="font-black text-slate-700 dark:text-slate-200">Génération du Bilan</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Imprimez ce document ou enregistrez-le en PDF via le navigateur.</p>
            </div>

            <button 
              onClick={generatePDF}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-white px-4 py-4 text-base font-black text-white dark:text-slate-900 transition-all hover:bg-slate-800 dark:hover:bg-slate-100 shadow-xl shadow-slate-900/20 dark:shadow-white/20 active:scale-95"
            >
              <FileText size={20} /> Imprimer / Sauvegarder
            </button>
          </div>
        </div>
      )}

      {/* MODAL : DÉTAILS SASS DU MEMBRE */}
      {isMemberModalVisible && selectedMemberDetails && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-black/60 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full sm:max-w-md bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 p-6 pb-4">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Détails Sass</h3>
              <button 
                onClick={() => setIsMemberModalVisible(false)} 
                className="rounded-full bg-slate-100/50 dark:bg-slate-800/50 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Fermer"
                title="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 pt-4 overflow-y-auto max-h-[75vh] custom-scrollbar">
              <div className="flex items-center mb-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-blue-500 to-blue-700 text-2xl font-black text-white shadow-lg shadow-blue-600/30 mr-4">
                  {selectedMemberDetails.first_name?.charAt(0)}{selectedMemberDetails.last_name?.charAt(0)}
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{selectedMemberDetails.first_name} {selectedMemberDetails.last_name}</h4>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{selectedMemberDetails.role}</p>
                </div>
              </div>

              {loadingMemberDetails ? (
                <div className="py-10 flex justify-center">
                   <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600/30 border-t-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {['Magal/Gamou', 'Ziaar', 'Keur Serigne Touba', 'Cahier Serigne Mountakha', 'Projets', 'Autres'].map(sassType => {
                    // Mapper le nom du type vers le champ de la base de données
                    let dbField = '';
                    if (sassType === 'Magal/Gamou') dbField = 'sass_magal';
                    if (sassType === 'Ziaar') dbField = 'sass_ziaar';
                    if (sassType === 'Keur Serigne Touba') dbField = 'sass_kst';
                    if (sassType === 'Cahier Serigne Mountakha') dbField = 'sass_cahier';
                    if (sassType === 'Projets') dbField = 'sass_projets';
                    if (sassType === 'Autres') dbField = 'sass_autres';

                    const goal = (selectedMemberDetails as unknown as Record<string, number>)[dbField] || 0;
                    const paid = memberContributions
                      .filter(c => c.sass_type === sassType)
                      .reduce((sum, c) => sum + c.amount, 0);

                    if (goal === 0 && paid === 0) return null;

                    const percent = goal > 0 ? Math.min(100, Math.round((paid / goal) * 100)) : (paid > 0 ? 100 : 0);
                    const isCompleted = percent >= 100;

                    return (
                      <div key={sassType} className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Sass {sassType}</span>
                          {isCompleted ? (
                            <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                              <CheckCircle size={10} className="mr-1" /> Terminé
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-500">{percent}%</span>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-end mb-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-0.5">Payé</p>
                            <p className={`font-black ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                              {paid.toLocaleString('fr-FR')} F
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-0.5">Engagement</p>
                            <p className="font-bold text-slate-700 dark:text-slate-300">{goal.toLocaleString('fr-FR')} F</p>
                          </div>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {memberContributions.length === 0 && (
                    <div className="p-6 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Aucun paiement enregistré pour ce membre.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
