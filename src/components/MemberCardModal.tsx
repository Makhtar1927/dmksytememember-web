import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, ShieldCheck, ShieldAlert, Loader2, CreditCard, ArrowRight, CheckCircle, Info, Copy, ExternalLink } from 'lucide-react';
import { QRCode } from 'react-qr-code';
import cardBackground from '../assets/Carte_Membre.webp';

/** Détecte Safari sur iOS (iPhone/iPad) */
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

interface MemberCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MemberInfo {
  id: string;
  first_name: string;
  last_name: string;
  role?: string;
  sector?: string;
  address?: string;
  dmk_id?: string;
  blood_type?: string;
  photo_url?: string;
  is_card_blocked?: boolean;
  card_status?: string;
  card_payment_date?: string;
  birth_date?: string;
  birth_place?: string;
  cni_number?: string;
  cni_issue_date?: string;
  phone?: string;
  join_date?: string;
  created_at?: string;
}

export default function MemberCardModal({ isOpen, onClose }: MemberCardModalProps) {
  const { user } = useAuth();
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);

  const [cardStatus, setCardStatus] = useState<'loading' | 'unrequested' | 'pending' | 'active' | 'blocked'>('loading');
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardActivationDate, setCardActivationDate] = useState<string | null>(null);
  /** Modal "bridge" affiché juste avant d'ouvrir Wave sur iOS */
  const [isBridgeModalOpen, setBridgeModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [cardScale, setCardScale] = useState(1);

  const wavePaymentLink = "https://pay.wave.com/m/M_sn_ZbFNd5sN85_6/c/sn/";

  useEffect(() => {
    if (!isOpen) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        const newScale = Math.min(1, containerWidth / 800);
        setCardScale(newScale);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [isOpen, cardStatus]);

  useEffect(() => {
    async function fetchUserData() {
      if (!user?.email || !isOpen) return;
      setCardStatus('loading');
      try {
        const { data: member, error } = await supabase
          .from('members')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();

        if (error) throw error;
        if (!member) {
          setCardStatus('unrequested');
          return;
        }
        setMemberInfo(member);

        if (member.is_card_blocked) {
          setCardStatus('blocked');
          return;
        }

        const dbCardStatus = member.card_status || 'unrequested';
        const dbCardPaymentDate = member.card_payment_date;

        if (dbCardStatus === 'active' && dbCardPaymentDate) {
          const issueDate = new Date(dbCardPaymentDate);
          const expiryDate = new Date(issueDate);
          expiryDate.setFullYear(expiryDate.getFullYear() + 5);

          if (new Date() > expiryDate) {
            setCardStatus('unrequested');
            setCardActivationDate(null);
          } else {
            setCardStatus('active');
            setCardActivationDate(dbCardPaymentDate);
          }
        } else if (dbCardStatus === 'pending') {
          setCardStatus('pending');
          setCardActivationDate(dbCardPaymentDate);
        } else {
          setCardStatus('unrequested');
          setCardActivationDate(null);
        }

      } catch (err) {
        console.error("Erreur de récupération du profil pour la carte:", err);
        setCardStatus('unrequested');
      }
    }

    fetchUserData();
  }, [user?.email, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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

  const handleConfirmPayment = async () => {
    setIsSubmitting(true);
    try {
      if (memberInfo) {
        const { error } = await supabase.from('sass_contributions').insert([{
          member_id: memberInfo.id,
          amount: 2000,
          payment_method: 'Wave',
          sass_type: 'Achat Carte Membre',
          status: 'En attente',
          payment_date: new Date().toISOString()
        }]);

        if (error) {
          console.error("Erreur lors de l'insertion:", error);
          alert("Erreur lors de l'enregistrement de l'intention de paiement.");
          return;
        }
      }

      setConfirmModalOpen(false);

      if (isIOS()) {
        // Sur iOS/Safari : afficher le modal bridge avec le montant copié (2000 FCFA)
        await copyAmountToClipboard('2000');
        setCopied(true);
        setBridgeModalOpen(true);
      } else {
        // Autres navigateurs : ouverture directe avec le montant
        const redirectUrl = `${wavePaymentLink}?amount=2000`;
        window.open(redirectUrl, '_blank', 'noopener');
        setCardStatus('pending');
      }
    } catch (error) {
      console.error("Erreur:", error);
      alert("Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWaveFromBridge = async () => {
    const redirectUrl = `${wavePaymentLink}?amount=2000`;
    // Tenter de copier à nouveau au moment du tap (requis par certains navigateurs)
    await copyAmountToClipboard('2000');
    setCardStatus('pending');
    setBridgeModalOpen(false);
    window.location.href = redirectUrl;
  };

  const handleCopyAgain = async () => {
    const ok = await copyAmountToClipboard('2000');
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  const cardDataForQR = memberInfo
    ? `ID:${memberInfo.dmk_id || 'N/A'} | Nom:${memberInfo.first_name} ${memberInfo.last_name} | Role:${memberInfo.role}`
    : 'Chargement...';

  const issueDate = cardActivationDate ? new Date(cardActivationDate) : new Date();
  const expiryDate = new Date(issueDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 5);
  const expiryFormatted = expiryDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatField = (val: string | null | undefined) => {
    return val && val.trim() !== '' ? val : 'NON RENSEIGNÉ';
  };

  const formatDateField = (dateStr?: string) => {
    if (!dateStr || dateStr.trim() === '') return 'NON RENSEIGNÉ';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'NON RENSEIGNÉ';
      return d.toLocaleDateString('fr-FR');
    } catch {
      return 'NON RENSEIGNÉ';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center p-3 sm:p-4 py-8">
        <div
          className="fixed inset-0 z-0"
          onClick={onClose}
          aria-label="Fermer la carte"
        ></div>

        <div className="relative z-10 flex flex-col w-full max-w-md sm:max-w-3xl animate-in zoom-in-95 duration-300">

          {/* Header actions */}
          <div className="w-full flex justify-between items-center mb-4 px-2">
            <h2 className="text-white font-bold tracking-widest uppercase text-sm drop-shadow-md">
              Ma Carte Virtuelle
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors border border-white/20 backdrop-blur-sm"
              aria-label="Fermer la carte"
              title="Fermer la carte"
            >
              <X size={20} />
            </button>
          </div>

          {/* Card Container */}
          {cardStatus === 'active' && memberInfo ? (
            <div ref={containerRef} className="w-full flex flex-col items-center justify-center overflow-hidden">
              <div 
                style={{ 
                  width: 800, 
                  height: 480, 
                  transform: `scale(${cardScale})`, 
                  transformOrigin: 'top center',
                  marginBottom: `${(cardScale - 1) * 480}px`
                }}
                className="relative rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/40 text-[#224857] font-['Outfit'] shrink-0 select-none"
              >
                {/* Background PNG template */}
                <img src={cardBackground} className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none" alt="Card Background" />

                {/* Profile Photo */}
                <div className="absolute top-[13.5%] left-[15.2%] w-[20.8%] h-[44%] rounded-[8%] overflow-hidden bg-white/50 border border-white/85 shadow-md flex items-center justify-center z-10">
                  {memberInfo.photo_url ? (
                    <img src={memberInfo.photo_url} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#cbebf6] to-[#e4f5fb] flex flex-col items-center justify-center text-[#2b5d72]/40">
                      <span className="text-5xl font-black">{memberInfo.first_name?.charAt(0)}{memberInfo.last_name?.charAt(0)}</span>
                    </div>
                  )}
                </div>

                {/* QR Code */}
                <div className="absolute top-[67%] left-[5%] w-[12.5%] aspect-square bg-white border border-white/80 p-[1%] rounded-[8%] shadow-sm z-10 flex items-center justify-center">
                  <QRCode
                    value={cardDataForQR}
                    size={256}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    bgColor="#ffffff"
                    fgColor="#224857"
                    level="Q"
                  />
                </div>

                {/* NOM label & value */}
                <div className="absolute top-[23.5%] left-[60%] z-10 whitespace-nowrap">
                  <span className="text-[#224857]/60 text-[7.5px] font-extrabold uppercase tracking-wider leading-none block">Nom</span>
                </div>
                <div className="absolute top-[26%] left-[60%] w-[17%] z-10 whitespace-nowrap">
                  <span className="text-[#193a47] font-black text-[13px] uppercase truncate block leading-none">
                    {formatField(memberInfo.last_name)}
                  </span>
                </div>

                {/* PRENOM label & value */}
                <div className="absolute top-[23.5%] left-[78%] z-10 whitespace-nowrap">
                  <span className="text-[#224857]/60 text-[7.5px] font-extrabold uppercase tracking-wider leading-none block">Prenom</span>
                </div>
                <div className="absolute top-[26%] left-[78%] w-[17%] z-10 whitespace-nowrap">
                  <span className="text-[#193a47] font-black text-[13px] uppercase truncate block leading-none">
                    {formatField(memberInfo.first_name)}
                  </span>
                </div>

                {/* DATE DE NAISSANCE label & value */}
                <div className="absolute top-[32%] left-[60%] z-10 whitespace-nowrap">
                  <span className="text-[#224857]/60 font-extrabold text-[7.5px] uppercase tracking-wider leading-none block">
                    Date de naissance
                  </span>
                </div>
                <div className="absolute top-[34.5%] left-[60%] z-10 whitespace-nowrap">
                  <span className="text-[#193a47] font-black text-[10px] leading-none block">
                    {formatDateField(memberInfo.birth_date)}
                  </span>
                </div>

                {/* LIEU DE NAISSANCE label & value */}
                <div className="absolute top-[32%] left-[78%] z-10 whitespace-nowrap">
                  <span className="text-[#224857]/60 font-extrabold text-[7.5px] uppercase tracking-wider leading-none block">
                    Lieu de naissance
                  </span>
                </div>
                <div className="absolute top-[34.5%] left-[78%] w-[18%] z-10 whitespace-nowrap">
                  <span className="text-[#193a47] font-black text-[10px] uppercase leading-none block truncate">
                    {formatField(memberInfo.birth_place)}
                  </span>
                </div>

                {/* Vertical List labels & values */}
                <div className="absolute top-[47.2%] left-[52.5%] right-[4%] z-10 flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                  <span className="text-[#224857]/70 text-[9.5px] font-extrabold uppercase leading-none shrink-0">Adresse:</span>
                  <span className="text-[#193a47] text-[9.5px] font-extrabold uppercase truncate leading-none">{formatField(memberInfo.address)}</span>
                </div>

                <div className="absolute top-[51.7%] left-[52.5%] right-[4%] z-10 flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                  <span className="text-[#224857]/70 text-[9.5px] font-extrabold uppercase leading-none shrink-0">Numero CNI:</span>
                  <span className="text-[#193a47] text-[9.5px] font-extrabold uppercase truncate leading-none">{formatField(memberInfo.cni_number)}</span>
                </div>

                <div className="absolute top-[56.2%] left-[52.5%] right-[4%] z-10 flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                  <span className="text-[#224857]/70 text-[9.5px] font-extrabold uppercase leading-none shrink-0">Date de delivrance CNI:</span>
                  <span className="text-[#193a47] text-[9.5px] font-extrabold uppercase truncate leading-none">{formatDateField(memberInfo.cni_issue_date)}</span>
                </div>

                <div className="absolute top-[60.7%] left-[52.5%] right-[4%] z-10 flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                  <span className="text-[#224857]/70 text-[9.5px] font-extrabold uppercase leading-none shrink-0">Telephone:</span>
                  <span className="text-[#193a47] text-[9.5px] font-extrabold uppercase truncate leading-none">{formatField(memberInfo.phone)}</span>
                </div>

                <div className="absolute top-[65.2%] left-[52.5%] right-[4%] z-10 flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                  <span className="text-[#224857]/70 text-[9.5px] font-extrabold uppercase leading-none shrink-0">Groupe sanguin:</span>
                  <span className="text-red-500 text-[9.5px] font-extrabold uppercase truncate leading-none">{formatField(memberInfo.blood_type)}</span>
                </div>

                <div className="absolute top-[69.7%] left-[52.5%] right-[4%] z-10 flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                  <span className="text-[#224857]/70 text-[9.5px] font-extrabold uppercase leading-none shrink-0">Date d'adhesion:</span>
                  <span className="text-[#193a47] text-[9.5px] font-extrabold uppercase truncate leading-none">{formatDateField(memberInfo.join_date || memberInfo.created_at)}</span>
                </div>

                <div className="absolute top-[74.2%] left-[52.5%] right-[4%] z-10 flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                  <span className="text-[#224857]/70 text-[9.5px] font-extrabold uppercase leading-none shrink-0">Fonction:</span>
                  <span className="text-[#193a47] text-[9.5px] font-extrabold uppercase truncate leading-none">{formatField(memberInfo.role)}</span>
                </div>

                <div className="absolute top-[78.7%] left-[52.5%] right-[4%] z-10 flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                  <span className="text-[#224857]/70 text-[9.5px] font-extrabold uppercase leading-none shrink-0">Secteur:</span>
                  <span className="text-[#193a47] text-[9.5px] font-extrabold uppercase truncate leading-none">{formatField(memberInfo.sector)}</span>
                </div>

                <div className="absolute top-[83.2%] left-[52.5%] right-[4%] z-10 flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                  <span className="text-[#224857]/70 text-[9.5px] font-extrabold uppercase leading-none shrink-0">Expire le:</span>
                  <span className="text-[#193a47] text-[9.5px] font-extrabold uppercase truncate leading-none">{expiryFormatted}</span>
                </div>

                {/* Matricule label & value */}
                <div className="absolute top-[67.5%] left-[20%] z-10 whitespace-nowrap">
                  <span className="text-[#224857]/60 text-[9.5px] font-extrabold uppercase leading-none block">Numéro Matricule:</span>
                </div>
                <div className="absolute top-[72%] left-[20%] text-left z-10 whitespace-nowrap">
                  <p className="text-[#193a47] font-mono font-black text-[12px] tracking-wide leading-none">
                    {memberInfo.dmk_id || 'NON RENSEIGNÉ'}
                  </p>
                </div>

                {/* Verified Indicator Badge */}
                <div className="absolute right-[4%] bottom-[4%] flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full backdrop-blur-md z-10">
                  <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                  <span className="text-emerald-600 font-extrabold text-[8.5px] uppercase tracking-widest">VÉRIFIÉ</span>
                </div>

              </div>
            </div>
          ) : (
            <div className="relative w-full rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 min-h-[420px] bg-gradient-to-br from-blue-900 via-indigo-800 to-slate-900 text-white flex flex-col justify-center items-center p-6 text-center">
              {cardStatus === 'loading' ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-white/50 mb-4" />
                  <p className="text-white/70 font-medium text-sm tracking-widest uppercase">Génération...</p>
                </>
              ) : !memberInfo ? (
                <>
                  <p className="text-red-300 font-bold mb-2">Erreur de chargement</p>
                  <p className="text-white/70 text-sm">Impossible de récupérer vos informations.</p>
                </>
              ) : cardStatus === 'unrequested' ? (
                <>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/10 backdrop-blur-md rounded-[20px] border border-white/20 shadow-inner flex items-center justify-center mb-5">
                    <CreditCard className="text-[#1DC4E9] drop-shadow-sm" size={36} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">Obtenir votre Carte Numérique</h3>
                  <p className="text-blue-100/70 mb-6 max-w-sm text-xs sm:text-sm">
                    La création de votre carte de membre numérique nécessite des frais de <strong className="text-white">2000 FCFA</strong>. Elle sera valide pour une durée de 5 ans.
                  </p>
                  <button
                    onClick={() => setConfirmModalOpen(true)}
                    className="w-full max-w-xs flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#1DC4E9] to-blue-500 hover:from-[#18A2C2] hover:to-blue-600 p-3.5 text-white shadow-xl shadow-[#1DC4E9]/30 transition-all active:scale-95 group"
                  >
                    <span className="text-sm font-black tracking-wide">Payer avec Wave</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </>
              ) : cardStatus === 'pending' ? (
                <>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/10 backdrop-blur-md rounded-[20px] border border-white/20 shadow-inner flex items-center justify-center mb-5 relative">
                    <div className="absolute inset-0 bg-amber-400/20 rounded-[20px] animate-pulse"></div>
                    <Loader2 className="text-amber-400 animate-spin" size={36} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">Validation en cours</h3>
                  <p className="text-blue-100/70 max-w-sm text-xs sm:text-sm">
                    Votre paiement est actuellement en attente de validation par le trésorier. Votre carte numérique sera disponible très prochainement.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-500/10 backdrop-blur-md rounded-[20px] border border-red-500/30 shadow-inner flex items-center justify-center mb-5">
                    <ShieldAlert className="text-red-500 drop-shadow-sm" size={36} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">Carte Bloquée</h3>
                  <p className="text-red-100/70 max-w-sm text-xs sm:text-sm">
                    Votre carte a été bloquée par un administrateur. Veuillez contacter le bureau pour obtenir le déblocage de votre compte.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Helper text under card */}
          {cardStatus === 'active' && (
            <p className="text-white/60 text-xs text-center mt-3 flex items-center justify-center gap-2 px-4">
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
              Présentez ce QR Code lors des événements DMK pour pointer votre présence.
            </p>
          )}

        </div>
      </div>

      {/* Confirmation Modal for Payment */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-md transition-all">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
            <div className="p-6 sm:p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-inner">
                <Info size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Confirmation</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm font-medium mb-6 leading-relaxed">
                Voulez-vous procéder au paiement de <strong className="text-[#1DC4E9]">2000 FCFA</strong> pour la création de votre carte de membre numérique ?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModalOpen(false)}
                  className="flex-1 rounded-2xl bg-slate-200 dark:bg-slate-800 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1DC4E9] to-blue-500 hover:from-[#18A2C2] hover:to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-[#1DC4E9]/30 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                >
                  {isSubmitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div> : <CheckCircle size={18} />}
                  {isSubmitting ? '...' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Bridge iOS pour Achat Carte Membre ─── */}
      {isBridgeModalOpen && (
        <div className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center bg-slate-900/70 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 duration-300">
            
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
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Montant de la carte</p>
                <p className="text-4xl font-black text-[#1DC4E9] tracking-tight">
                  2 000
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
}
