import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  MapPin, Briefcase, Droplets, CreditCard, Calendar, Loader2, Camera,
  User, Bell, BellOff, Pencil, X, CheckCircle, Phone, AlertCircle, ShieldAlert, Lock, Info
} from 'lucide-react';
import { subscribeToPushNotifications, checkPushNotificationStatus, unsubscribeFromPushNotifications } from '../utils/pushNotifications';
import { uploadMemberPhoto } from '../utils/photoUpload';

type MemberInfo = {
  id: string;
  dmk_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  sector: string;
  role: string;
  status: string;
  gender: string | null;
  birth_date: string | null;
  birth_place: string | null;
  address: string | null;
  profession: string | null;
  cni_number: string | null;
  cni_issue_date: string | null;
  cni_expiry_date: string | null;
  blood_type: string | null;
  photo_url: string | null;
  join_date: string | null;
};

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function Profil() {
  const { user } = useAuth();
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editForm, setEditForm] = useState<Partial<MemberInfo>>({});

  // Vérification initiale du statut certifié des notifications
  useEffect(() => {
    async function initPushStatus() {
      const status = await checkPushNotificationStatus(memberInfo?.id || null);
      setIsPushEnabled(status.isEnabled);
    }
    initPushStatus();
  }, [memberInfo?.id]);

  const handleEnablePush = async () => {
    if (!memberInfo?.id) return;
    setPushLoading(true);
    setPushFeedback(null);

    // Vérifier si la permission est déjà bloquée par le navigateur
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setShowPermissionModal(true);
      setPushLoading(false);
      return;
    }

    const result = await subscribeToPushNotifications(memberInfo.id);

    if (result.code === 'PERMISSION_DENIED' || result.message?.includes('refus')) {
      setShowPermissionModal(true);
    } else if (result.success) {
      setIsPushEnabled(true);
      setPushFeedback({ type: 'success', message: result.message });
      setTimeout(() => setPushFeedback(null), 5000);
    } else {
      setPushFeedback({ type: 'error', message: result.message });
    }
    setPushLoading(false);
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    setPushFeedback(null);

    const result = await unsubscribeFromPushNotifications(memberInfo?.id || null);

    if (result.success) {
      setIsPushEnabled(false);
      setPushFeedback({ type: 'success', message: 'Notifications désactivées avec succès.' });
      setTimeout(() => setPushFeedback(null), 5000);
    } else {
      setPushFeedback({ type: 'error', message: result.message });
    }
    setPushLoading(false);
  };

  useEffect(() => {
    async function fetchUserData() {
      if (!user?.email) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .eq('email', user.email)
          .single();
        if (error) throw error;
        setMemberInfo(data as MemberInfo);
      } catch (err) {
        console.error('Erreur de récupération du profil:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUserData();
  }, [user]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user?.email) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      const newPhotoUrl = await uploadMemberPhoto(file, user.email);
      setMemberInfo((prev) => prev ? { ...prev, photo_url: newPhotoUrl } : prev);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi de la photo.";
      alert(msg);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleStartEdit = () => {
    if (!memberInfo) return;
    setEditForm({
      phone: memberInfo.phone ?? '',
      address: memberInfo.address ?? '',
      profession: memberInfo.profession ?? '',
      birth_date: memberInfo.birth_date ?? '',
      birth_place: memberInfo.birth_place ?? '',
      cni_number: memberInfo.cni_number ?? '',
      cni_issue_date: memberInfo.cni_issue_date ?? '',
      cni_expiry_date: memberInfo.cni_expiry_date ?? '',
      blood_type: memberInfo.blood_type ?? '',
      gender: memberInfo.gender ?? 'Masculin',
    });
    setSaveError(null);
    setSaveSuccess(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
    setSaveSuccess(false);
    setEditForm({});
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!memberInfo) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const payload: Partial<MemberInfo> = {
      phone: editForm.phone || null,
      address: editForm.address || null,
      profession: editForm.profession || null,
      birth_date: editForm.birth_date || null,
      birth_place: editForm.birth_place || null,
      cni_number: editForm.cni_number || null,
      cni_issue_date: editForm.cni_issue_date || null,
      cni_expiry_date: editForm.cni_expiry_date || null,
      blood_type: editForm.blood_type || null,
      gender: editForm.gender || null,
    };

    try {
      const { error } = await supabase
        .from('members')
        .update(payload)
        .eq('id', memberInfo.id);
      if (error) throw error;
      setMemberInfo((prev) => prev ? { ...prev, ...payload } : prev);
      setSaveSuccess(true);
      setTimeout(() => {
        setIsEditing(false);
        setSaveSuccess(false);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !memberInfo) {
    return (
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center p-8 relative z-10">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600/30 border-t-blue-600 drop-shadow-md mb-4"></div>
        <p className="mt-2 text-sm font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400 animate-pulse">Chargement du profil...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-6 md:space-y-8 relative z-10 pb-40 md:pb-8">

      {/* ── HEADER CARD ── */}
      <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left rounded-[32px] bg-white/60 dark:bg-slate-900/50 p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white/50 dark:border-slate-700/50 transition-all duration-500">
        
        {/* Avatar */}
        <div className="relative mb-5 md:mb-0 md:mr-6 shrink-0 group">
          <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-blue-500 to-blue-700 text-4xl font-black text-white shadow-lg shadow-blue-600/30 overflow-hidden border-2 border-white dark:border-slate-800">
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : memberInfo.photo_url ? (
              <img src={memberInfo.photo_url} alt="Profil" className="h-full w-full object-cover" />
            ) : (
              <span>{memberInfo.first_name?.charAt(0)}{memberInfo.last_name?.charAt(0)}</span>
            )}
          </div>
          <label className="absolute -bottom-2 -right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/40 hover:bg-blue-700 hover:scale-110 transition-all duration-300 ring-2 ring-white dark:ring-slate-900">
            <Camera size={14} />
            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} />
          </label>
        </div>

        <div className="flex-1">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white md:text-3xl tracking-tight">
            {memberInfo.first_name} {memberInfo.last_name}
          </h2>
          <p className="text-base font-bold text-slate-500 dark:text-slate-400 mb-2 mt-1">
            {memberInfo.role} • Secteur {memberInfo.sector}
          </p>
          <div className="inline-flex flex-col md:flex-row flex-wrap gap-2 mt-2">
            <span className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-bold border border-blue-100 dark:border-blue-800/30">
              ID DMK: {memberInfo.dmk_id || 'Non attribué'}
            </span>
            <span className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold border border-slate-200 dark:border-slate-700">
              {memberInfo.email}
            </span>
            {memberInfo.phone && (
              <span className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold border border-slate-200 dark:border-slate-700">
                {memberInfo.phone}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── INFORMATIONS PERSONNELLES ── */}
      <div className="rounded-[32px] bg-white/60 dark:bg-slate-900/50 p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white/50 dark:border-slate-700/50 transition-all duration-500">
        
        {/* Section header with Edit button */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            Dossier Personnel &amp; Administratif
          </h3>
          {!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 active:scale-95"
            >
              <Pencil size={15} />
              Modifier mes informations
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={handleCancelEdit}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                <X size={15} />
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || saveSuccess}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                {isSaving ? 'Enregistrement...' : saveSuccess ? 'Sauvegardé !' : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>

        {/* Feedback banners */}
        {saveError && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm font-medium text-red-600 dark:text-red-400">
            <AlertCircle size={18} className="shrink-0" />
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle size={18} className="shrink-0" />
            Informations mises à jour avec succès.
          </div>
        )}

        {/* ── EDIT FORM ── */}
        {isEditing ? (
          <div className="space-y-5">

            {/* Téléphone + Genre */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <Phone size={12} className="inline mr-1" />Téléphone
                </label>
                <input
                  name="phone"
                  value={editForm.phone ?? ''}
                  onChange={handleFormChange}
                  placeholder="+221 77 000 00 00"
                  type="tel"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <User size={12} className="inline mr-1" />Sexe / Genre
                </label>
                <select
                  name="gender"
                  value={editForm.gender ?? 'Masculin'}
                  onChange={handleFormChange}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                >
                  <option value="Masculin">Masculin</option>
                  <option value="Féminin">Féminin</option>
                </select>
              </div>
            </div>

            {/* Date + Lieu de naissance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <Calendar size={12} className="inline mr-1" />Date de naissance
                </label>
                <input
                  name="birth_date"
                  value={editForm.birth_date ?? ''}
                  onChange={handleFormChange}
                  type="date"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <MapPin size={12} className="inline mr-1" />Lieu de naissance
                </label>
                <input
                  name="birth_place"
                  value={editForm.birth_place ?? ''}
                  onChange={handleFormChange}
                  placeholder="Ex: Dakar"
                  type="text"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            {/* Profession */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <Briefcase size={12} className="inline mr-1" />Profession
              </label>
              <input
                name="profession"
                value={editForm.profession ?? ''}
                onChange={handleFormChange}
                placeholder="Ex: Enseignant, Ingénieur..."
                type="text"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Adresse */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <MapPin size={12} className="inline mr-1" />Adresse de résidence
              </label>
              <input
                name="address"
                value={editForm.address ?? ''}
                onChange={handleFormChange}
                placeholder="Quartier, Rue, Ville..."
                type="text"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* CNI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <CreditCard size={12} className="inline mr-1" />Numéro CNI
                </label>
                <input
                  name="cni_number"
                  value={editForm.cni_number ?? ''}
                  onChange={handleFormChange}
                  placeholder="N° pièce d'identité"
                  type="text"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Date délivrance CNI</label>
                <input
                  name="cni_issue_date"
                  value={editForm.cni_issue_date ?? ''}
                  onChange={handleFormChange}
                  type="date"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Date expiration CNI</label>
                <input
                  name="cni_expiry_date"
                  value={editForm.cni_expiry_date ?? ''}
                  onChange={handleFormChange}
                  type="date"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            {/* Groupe sanguin */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <Droplets size={12} className="inline mr-1" />Groupe Sanguin
              </label>
              <div className="flex flex-wrap gap-2">
                {['', ...BLOOD_TYPES].map((bt) => (
                  <button
                    key={bt || 'none'}
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, blood_type: bt || null }))}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                      (editForm.blood_type ?? '') === bt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {bt || 'Non spécifié'}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500 italic pt-1">
              * Les champs Nom, Prénom, Email, Rôle, Secteur et ID DMK ne peuvent être modifiés que par l'administrateur.
            </p>
          </div>

        ) : (
          /* ── VIEW MODE ── */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {memberInfo.phone && (
              <InfoCard icon={<Phone size={20} />} color="blue" label="Téléphone" value={memberInfo.phone} />
            )}
            {memberInfo.gender && (
              <InfoCard icon={<User size={20} />} color="indigo" label="Sexe" value={memberInfo.gender} />
            )}
            {memberInfo.birth_date && (
              <InfoCard
                icon={<Calendar size={20} />} color="blue" label="Né(e) le"
                value={`${new Date(memberInfo.birth_date).toLocaleDateString('fr-FR')}${memberInfo.birth_place ? ` à ${memberInfo.birth_place}` : ''}`}
              />
            )}
            {memberInfo.profession && (
              <InfoCard icon={<Briefcase size={20} />} color="purple" label="Profession" value={memberInfo.profession} />
            )}
            {memberInfo.address && (
              <div className="md:col-span-2">
                <InfoCard icon={<MapPin size={20} />} color="emerald" label="Adresse" value={memberInfo.address} />
              </div>
            )}
            {memberInfo.cni_number && (
              <InfoCard icon={<CreditCard size={20} />} color="orange" label="N° CNI" value={memberInfo.cni_number} />
            )}
            {memberInfo.blood_type && (
              <InfoCard icon={<Droplets size={20} />} color="red" label="Groupe Sanguin" value={memberInfo.blood_type} />
            )}

            {(!memberInfo.phone && !memberInfo.birth_date && !memberInfo.profession && !memberInfo.address && !memberInfo.cni_number && !memberInfo.blood_type && !memberInfo.gender) && (
              <div className="md:col-span-2 text-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 font-medium">Votre dossier n'est pas encore complété.</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Cliquez sur <strong>Modifier</strong> pour renseigner vos informations personnelles.</p>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION NOTIFICATIONS PUSH ── */}
        <div className="mt-8 flex flex-col items-center p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80 border border-blue-100 dark:border-slate-700 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            {isPushEnabled ? <BellOff size={24} className="text-amber-600 dark:text-amber-400" /> : <Bell size={24} />}
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Notifications Systèmes</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 mb-3">Soyez alerté en temps réel des rappels et annonces importantes du Dahira.</p>

          {/* Badge du statut certifié */}
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all border shadow-xs">
            {isPushEnabled ? (
              <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Notifications Activées
              </span>
            ) : (
              <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Notifications Désactivées
              </span>
            )}
          </div>

          {/* Feedback d'activation / désactivation */}
          {pushFeedback && (
            <div className={`w-full mb-4 flex items-start gap-3 p-4 rounded-2xl text-left text-sm font-medium ${
              pushFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300'
            }`}>
              {pushFeedback.type === 'success'
                ? <CheckCircle size={18} className="shrink-0 mt-0.5" />
                : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
              <span>{pushFeedback.message}</span>
            </div>
          )}

          {isPushEnabled ? (
            <button
              onClick={handleDisablePush}
              disabled={pushLoading}
              className="flex items-center px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              {pushLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <BellOff size={16} className="mr-2" />}
              Désactiver les notifications
            </button>
          ) : (
            <button
              onClick={handleEnablePush}
              disabled={pushLoading}
              className="flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              {pushLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Bell size={16} className="mr-2" />}
              Activer les notifications
            </button>
          )}
        </div>
      </div>

      {/* ── MODAL GUIDAGE : Permission de notification bloquée ── */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200/80 dark:border-slate-700 max-h-[82vh] flex flex-col mb-16 sm:mb-0 my-auto">
            {/* Header */}
            <div className="flex flex-col items-center px-5 sm:px-6 pt-5 sm:pt-7 pb-3 text-center shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 shadow-inner">
                <ShieldAlert size={24} className="sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                Notifications Bloquées
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-xs">
                Votre navigateur a bloqué les notifications. Voici comment les débloquer :
              </p>
            </div>

            {/* Instructions */}
            <div className="px-5 sm:px-6 py-2 space-y-2 sm:space-y-3 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-sm">1</span>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-normal flex-1">
                  Appuyez sur l'icône{' '}
                  <span className="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 bg-slate-200/80 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 mx-0.5">
                    <Lock size={11} className="inline" /> cadenas
                  </span>{' '}ou{' '}
                  <span className="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 bg-slate-200/80 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 mx-0.5">
                    <Info size={11} className="inline" /> infos
                  </span>{' '}
                  dans la barre d'adresse.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-sm">2</span>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-normal flex-1">
                  Allez dans <strong>Paramètres du site</strong> → <strong>Notifications</strong> → changez en <strong>Autoriser</strong>.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-sm">3</span>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-normal flex-1">
                  Rechargez la page puis cliquez à nouveau sur <strong>Activer les notifications</strong>.
                </p>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="px-5 sm:px-6 pt-3 pb-5 sm:pb-6 flex flex-col gap-2 shrink-0">
              <button
                onClick={() => { window.location.reload(); }}
                className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm transition-all shadow-md shadow-blue-600/30"
              >
                Recharger la page
              </button>
              <button
                onClick={() => setShowPermissionModal(false)}
                className="w-full py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-component: Info display card ──
type InfoCardProps = {
  icon: React.ReactNode;
  color: 'blue' | 'purple' | 'emerald' | 'orange' | 'red' | 'indigo';
  label: string;
  value: string;
};

const colorMap: Record<InfoCardProps['color'], string> = {
  blue:    'bg-blue-100    dark:bg-blue-900/30    text-blue-600    dark:text-blue-400',
  purple:  'bg-purple-100  dark:bg-purple-900/30  text-purple-600  dark:text-purple-400',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  orange:  'bg-orange-100  dark:bg-orange-900/30  text-orange-600  dark:text-orange-400',
  red:     'bg-red-100     dark:bg-red-900/30     text-red-600     dark:text-red-400',
  indigo:  'bg-indigo-100  dark:bg-indigo-900/30  text-indigo-600  dark:text-indigo-400',
};

function InfoCard({ icon, color, label, value }: InfoCardProps) {
  return (
    <div className="flex items-center p-4 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-white dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 mr-4 ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-base font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
