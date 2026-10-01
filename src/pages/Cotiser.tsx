import { useState, useEffect } from 'react';
import { Wallet, Smartphone, Info, X, CheckCircle, ArrowRight, Copy, ExternalLink } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface MemberProfile {
  id: string;
  first_name: string;
  last_name: string;
}

/** Détecte Safari sur iOS (iPhone/iPad) */
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const Cotiser = () => {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  
  const [isAmountModalOpen, setAmountModalOpen] = useState(false);
  const [amount, setAmount] = useState<string>(() => {
    return location.state?.amount ? location.state.amount.toString() : '';
  });
  const [isConfirmModalOpen, setConfirmModalOpen] = useState<boolean>(() => {
    return !!location.state?.amount;
  });
  /** Modal "bridge" affiché juste avant d'ouvrir Wave sur iOS */
  const [isBridgeModalOpen, setBridgeModalOpen] = useState(false);
  const [bridgeAmount, setBridgeAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [sassType, setSassType] = useState('Magal/Gamou');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sassTypes = ['Magal/Gamou', 'Ziaar', 'Keur Serigne Touba', 'Cahier Serigne Mountakha', 'Projets', 'Autres'];
  const wavePaymentLink = "https://pay.wave.com/m/M_sn_ZbFNd5sN85_6/c/sn/";

  useEffect(() => {
    if (session?.user?.email) {
      supabase.from('members').select('*').eq('email', session.user.email).maybeSingle()
        .then(({ data }) => {
          if (data) setProfile(data);
        });
    }
  }, [session]);

  useEffect(() => {
    if (location.state?.amount) {
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    if (isAmountModalOpen || isConfirmModalOpen || isBridgeModalOpen) {
      document.body.classList.add('hide-bottom-nav');
    } else {
      document.body.classList.remove('hide-bottom-nav');
    }
    return () => {
      document.body.classList.remove('hide-bottom-nav');
    };
  }, [isAmountModalOpen, isConfirmModalOpen, isBridgeModalOpen]);

  const handleInitialClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setAmountModalOpen(true);
  };

  const handleAmountSubmit = () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Veuillez saisir un montant valide.");
      return;
    }
    setAmountModalOpen(false);
    setConfirmModalOpen(true);
  };

  /** Copie le montant dans le presse-papier et retourne true si réussi */
  const copyAmountToClipboard = async (amt: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(amt);
      return true;
    } catch {
      // Fallback pour les navigateurs sans API clipboard
      try {
        const el = document.createElement('input');
        el.value = amt;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        return true;
      } catch {
        return false;
      }
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      if (profile) {
        const { error } = await supabase.from('sass_contributions').insert([{
          member_id: profile.id,
          amount: Number(amount),
          payment_method: 'Wave',
          sass_type: sassType,
          status: 'En attente',
          payment_date: new Date().toISOString()
        }]);
        if (error) console.error("Erreur lors de l'insertion:", error);
      }

      setConfirmModalOpen(false);

      if (isIOS()) {
        // Sur iOS/Safari : afficher le modal bridge avec le montant copié
        setBridgeAmount(amount);
        await copyAmountToClipboard(amount);
        setCopied(true);
        setBridgeModalOpen(true);
      } else {
        // Autres navigateurs : ouverture directe avec le montant
        const redirectUrl = `${wavePaymentLink}?amount=${amount}`;
        window.open(redirectUrl, '_blank', 'noopener');
      }
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la cotisation:", error);
      alert("Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
      setAmount('');
    }
  };

  const handleOpenWaveFromBridge = async () => {
    const redirectUrl = `${wavePaymentLink}?amount=${bridgeAmount}`;
    // Tenter de copier à nouveau au moment du tap (requis par certains navigateurs)
    await copyAmountToClipboard(bridgeAmount);
    // window.location.href fonctionne mieux que window.open pour les Universal Links sur iOS
    window.location.href = redirectUrl;
  };

  const handleCopyAgain = async () => {
    const ok = await copyAmountToClipboard(bridgeAmount);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-6 md:space-y-8 relative z-10 pb-40 md:pb-8">
      
      {/* Header */}
      <div className="flex items-center rounded-[32px] bg-white/60 dark:bg-slate-900/50 p-5 md:p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white/50 dark:border-slate-700/50 transition-all duration-500 hover:shadow-2xl">
        <div className="mr-5 flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#1DC4E9] to-blue-600 text-white shadow-lg shadow-[#1DC4E9]/30">
          <Wallet size={32} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-black text-slate-900 dark:text-white md:text-3xl tracking-tight transition-colors">
            Faire une Cotisation
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 transition-colors">
            Payer votre Sass ou faire un don facilement via Wave.
          </p>
        </div>
      </div>

      {/* Payment Card */}
      <div className="rounded-[32px] bg-white/60 dark:bg-slate-900/50 p-6 md:p-10 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white/50 dark:border-slate-700/50 transition-all duration-500">
        <div className="flex flex-col items-center justify-center">
          
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-[#1DC4E9]/20 blur-xl rounded-full animate-pulse"></div>
            <div className="w-24 h-24 bg-white/80 dark:bg-slate-800/80 rounded-[28px] flex items-center justify-center border border-[#1DC4E9]/30 shadow-lg shadow-[#1DC4E9]/10 relative z-10">
              <Smartphone className="text-[#1DC4E9] drop-shadow-sm" size={48} />
            </div>
          </div>

          <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-6 text-center tracking-tight transition-colors">
            Paiement via Wave
          </h3>

          {/* Instruction Box */}
          <div className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/30 rounded-2xl p-5 mb-10 max-w-md w-full shadow-inner transition-colors">
            <div className="flex items-start gap-3">
              <Info className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" size={24} />
              <div>
                <p className="text-blue-900 dark:text-blue-300 font-bold mb-1.5 tracking-wide uppercase text-xs">
                  Instruction
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200/80 leading-relaxed italic font-medium">
                  "Men ngaa joxe sa sass jaré ko ci lien bii di ci souf. Bo paré nga wax ko sa Dieuwrigne Darou mu dugal ko ci système bi."
                </p>
              </div>
            </div>
          </div>

          {/* Bouton de paiement (mobile focus) */}
          <button
            onClick={handleInitialClick}
            className="w-full max-w-md flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#1DC4E9] to-blue-500 hover:from-[#18A2C2] hover:to-blue-600 p-5 mb-6 text-white shadow-xl shadow-[#1DC4E9]/30 transition-all duration-300 active:scale-[0.98] group"
          >
            <Smartphone className="mr-3 group-hover:-rotate-12 transition-transform" size={26} />
            <span className="text-lg font-black tracking-wide">Cotiser avec Wave</span>
          </button>

        </div>
      </div>

      {/* Amount Modal */}
      {isAmountModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-md transition-all">
          <div className="w-full sm:max-w-md bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 p-6 pb-4">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Montant de la cotisation</h3>
              <button 
                onClick={() => setAmountModalOpen(false)} 
                className="rounded-full bg-slate-100/50 dark:bg-slate-800/50 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Fermer"
                title="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 pt-6 mb-4 sm:mb-0 pb-10 sm:pb-6">
              <label htmlFor="sass-category-select" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Catégorie (Rubrique)</label>
              <select 
                id="sass-category-select"
                value={sassType}
                onChange={e => setSassType(e.target.value)}
                title="Catégorie (Rubrique)"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 px-4 py-4 text-base font-bold text-slate-900 dark:text-white focus:border-[#1DC4E9] focus:outline-none focus:ring-4 focus:ring-[#1DC4E9]/20 transition-all mb-4 appearance-none"
              >
                {sassTypes.map(type => (
                  <option key={type} value={type}>Sass {type}</option>
                ))}
              </select>

              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Combien souhaitez-vous cotiser ? (FCFA)</label>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder="Ex: 5000" 
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 px-4 py-4 text-xl font-black text-slate-900 dark:text-white focus:border-[#1DC4E9] focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-[#1DC4E9]/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 mb-6" 
              />
              
              <button 
                onClick={handleAmountSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1DC4E9] to-blue-500 hover:from-[#18A2C2] hover:to-blue-600 px-4 py-4 text-base font-bold text-white shadow-xl shadow-[#1DC4E9]/30 transition-all active:scale-95"
              >
                Continuer <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-md transition-all">
          <div className="w-full sm:max-w-md bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
            <div className="p-8 pb-12 sm:pb-8 text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-inner">
                <Info size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Confirmation</h3>
              <p className="text-slate-600 dark:text-slate-300 text-lg font-medium mb-8 leading-relaxed">
                {profile?.first_name || 'Cher membre'} {profile?.last_name || ''}, voulez-vous faire une cotisation <strong className="text-blue-500 dark:text-blue-400">Sass {sassType}</strong> d'un montant de <strong className="text-[#1DC4E9]">{Number(amount).toLocaleString('fr-FR')} FCFA</strong> ?
              </p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModalOpen(false)}
                  className="flex-1 rounded-2xl bg-slate-200 dark:bg-slate-800 px-4 py-4 text-base font-bold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1DC4E9] to-blue-500 hover:from-[#18A2C2] hover:to-blue-600 px-4 py-4 text-base font-bold text-white shadow-xl shadow-[#1DC4E9]/30 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                >
                  {isSubmitting ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div> : <CheckCircle size={20} />}
                  {isSubmitting ? '...' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Bridge iOS ─── */}
      {isBridgeModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-900/70 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Ouvrir Wave</h3>
              <button
                onClick={() => setBridgeModalOpen(false)}
                className="rounded-full bg-slate-100 dark:bg-slate-800 p-2 text-slate-500 dark:text-slate-400"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 pb-10 sm:pb-6 space-y-5">

              {/* Montant mis en évidence */}
              <div className="rounded-2xl bg-gradient-to-br from-[#1DC4E9]/10 to-blue-500/10 border border-[#1DC4E9]/30 p-5 text-center">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Montant à payer</p>
                <p className="text-4xl font-black text-[#1DC4E9] tracking-tight">
                  {Number(bridgeAmount).toLocaleString('fr-FR')}
                  <span className="text-lg ml-2 font-bold text-slate-500">FCFA</span>
                </p>
              </div>

              {/* Statut clipboard */}
              <div className={`flex items-center gap-3 rounded-2xl p-4 transition-colors ${copied ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30' : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'}`}>
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${copied ? 'bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                  {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${copied ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                    {copied ? 'Montant copié dans le presse-papier ✓' : 'Copier le montant'}
                  </p>
                  {copied && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Collez-le dans Wave si demandé
                    </p>
                  )}
                </div>
                <button
                  onClick={handleCopyAgain}
                  className="shrink-0 text-xs font-bold text-[#1DC4E9] hover:underline"
                >
                  Recopier
                </button>
              </div>

              {/* Explication iOS */}
              <div className="flex items-start gap-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/40 dark:border-amber-800/30 p-4">
                <Info className="text-amber-500 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-relaxed font-medium">
                  Sur iPhone, appuyez sur <strong>«&nbsp;Ouvrir Wave&nbsp;»</strong> ci-dessous. Si Wave s'ouvre sans le montant, collez le montant copié dans le champ prévu.
                </p>
              </div>

              {/* CTA principal */}
              <button
                onClick={handleOpenWaveFromBridge}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#1DC4E9] to-blue-500 hover:from-[#18A2C2] hover:to-blue-600 px-4 py-4 text-base font-black text-white shadow-xl shadow-[#1DC4E9]/30 transition-all active:scale-95"
              >
                <ExternalLink size={20} />
                Ouvrir Wave
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Cotiser;
