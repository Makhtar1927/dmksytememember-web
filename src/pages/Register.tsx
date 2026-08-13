import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, FileText, Coins, ArrowRight, ArrowLeft, CheckCircle, Eye, EyeOff, Clock, ShieldCheck, FileCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SECTORS = [
  "Vaisselle", "Café", "Restauration", "Organisation", "Sonorisation",
  "Visuelle", "Bétail", "Cuisine", "Eau & Hygiène", "Protocole",
  "Decoration", "Culturelle", "Conservatoire", "Campagne", "Jayanté Kat yi",
  "Nouveau"
];

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ dmk_id: string } | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Form State with all admin registry fields
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    sector: '',
    gender: 'Masculin',
    birth_date: '',
    birth_place: '',
    address: '',
    profession: '',
    cni_number: '',
    cni_issue_date: '',
    cni_expiry_date: '',
    blood_type: '',
    join_date: new Date().toISOString().split('T')[0],
    sass_magal: '',
    sass_ziaar: '',
    sass_kst: '',
    sass_cahier: '',
    sass_projets: '',
    sass_autres: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      setError('Veuillez remplir tous les champs obligatoires (*)');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (!acceptedTerms) {
      setError('Vous devez accepter la politique de confidentialité et les conditions d\'utilisation avant de soumettre le formulaire.');
      return;
    }

    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          sector: formData.sector,
          gender: formData.gender,
          birth_date: formData.birth_date,
          birth_place: formData.birth_place,
          address: formData.address,
          profession: formData.profession,
          cni_number: formData.cni_number,
          cni_issue_date: formData.cni_issue_date,
          cni_expiry_date: formData.cni_expiry_date,
          blood_type: formData.blood_type,
          join_date: formData.join_date,
          sass_magal: formData.sass_magal,
          sass_ziaar: formData.sass_ziaar,
          sass_kst: formData.sass_kst,
          sass_cahier: formData.sass_cahier,
          sass_projets: formData.sass_projets,
          sass_autres: formData.sass_autres
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de l\'inscription.');
      }

      setSuccessData({ dmk_id: data.dmk_id });

    } catch (err: unknown) {
      // Direct client fallback
      try {
        const year = new Date().getFullYear();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const generatedDmkId = `DMK-${year}-${randomNum}`;

        const { error: authErr } = await supabase.auth.signUp({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          options: {
            data: {
              first_name: formData.first_name,
              last_name: formData.last_name,
              dmk_id: generatedDmkId
            }
          }
        });

        if (authErr) throw authErr;

        const { error: dbErr } = await supabase.from('members').insert([{
          dmk_id: generatedDmkId,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone || null,
          sector: formData.sector || 'Non attribué',
          role: 'Membre Simple',
          status: 'En attente',
          gender: formData.gender || 'Masculin',
          birth_date: formData.birth_date || null,
          birth_place: formData.birth_place || null,
          address: formData.address || null,
          profession: formData.profession || null,
          cni_number: formData.cni_number || null,
          cni_issue_date: formData.cni_issue_date || null,
          cni_expiry_date: formData.cni_expiry_date || null,
          blood_type: formData.blood_type || null,
          join_date: formData.join_date || new Date().toISOString().split('T')[0],
          sass_magal: Number(formData.sass_magal) || 0,
          sass_ziaar: Number(formData.sass_ziaar) || 0,
          sass_kst: Number(formData.sass_kst) || 0,
          sass_cahier: Number(formData.sass_cahier) || 0,
          sass_projets: Number(formData.sass_projets) || 0,
          sass_autres: Number(formData.sass_autres) || 0
        }]);

        if (dbErr) throw dbErr;

        setSuccessData({ dmk_id: generatedDmkId });

      } catch (fallbackErr: unknown) {
        const errMsg = err instanceof Error ? err.message : '';
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : '';
        setError(errMsg || fallbackMsg || 'Échec de l\'inscription.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-500 overflow-y-auto font-sans">
      
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-400/30 dark:bg-blue-600/10 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-cyan-400/20 dark:bg-cyan-800/20 blur-[150px] animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-3xl my-8">
        
        {/* Top Back Link */}
        <div className="mb-6">
          <Link to="/login" className="inline-flex items-center text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors">
            <ArrowLeft size={16} className="mr-2" />
            Retour à la connexion
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 h-24 w-24 overflow-hidden rounded-3xl border-2 border-white/60 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 shadow-xl">
            <img 
              src="/icon.png" 
              alt="DMK Logo" 
              className="h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Inscription Membre DMK</h1>
          <p className="mt-1 text-xs font-bold tracking-widest text-slate-500 uppercase">Fiche d'enregistrement officielle</p>
        </div>

        {/* Card Form container */}
        <div className="rounded-[32px] border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-6 md:p-10 shadow-2xl backdrop-blur-xl">
          
          {successData ? (
            <div className="py-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-lg">
                <Clock size={44} className="animate-pulse" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Demande d'inscription enregistrée</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Votre identifiant membre DMK attribué :
                </p>
                <div className="inline-block rounded-2xl bg-blue-500/10 border border-blue-500/30 px-6 py-2 text-xl font-black font-mono text-blue-600 dark:text-blue-400 shadow-inner">
                  {successData.dmk_id}
                </div>
              </div>

              {/* Warning / Status Banner */}
              <div className="mx-auto max-w-lg rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-left text-sm text-slate-800 dark:text-slate-200 space-y-3 shadow-sm">
                <div className="flex items-center font-bold text-base border-b border-blue-500/10 pb-2.5 text-blue-600 dark:text-blue-400">
                  <ShieldCheck size={20} className="mr-2 shrink-0 text-blue-600 dark:text-blue-400" />
                  Compte en attente de validation
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Votre compte est actuellement <span className="font-bold text-slate-900 dark:text-white">en attente d'activation</span>. Votre dossier sera examiné et <span className="font-bold text-slate-900 dark:text-white">validé par l'administrateur d'ici 48h</span> après vérification des informations fournies.
                </p>

                {/* Timeline Steps - Professional Unicolor Vector Icons */}
                <div className="pt-2 grid grid-cols-3 gap-2.5 text-center text-xs font-semibold">
                  <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-3 rounded-xl border border-blue-500/20 flex flex-col items-center justify-center">
                    <CheckCircle size={18} className="mb-1 text-blue-600 dark:text-blue-400" />
                    <span className="block text-[10px] uppercase text-blue-600/70 dark:text-blue-400/70 font-extrabold">Étape 1</span>
                    <span className="text-[11px] font-bold">Soumise</span>
                  </div>
                  <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-3 rounded-xl border border-blue-500/20 flex flex-col items-center justify-center">
                    <Clock size={18} className="mb-1 text-blue-600 dark:text-blue-400 animate-pulse" />
                    <span className="block text-[10px] uppercase text-blue-600/70 dark:text-blue-400/70 font-extrabold">Étape 2</span>
                    <span className="text-[11px] font-bold">Examen (48h max)</span>
                  </div>
                  <div className="bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 p-3 rounded-xl border border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center">
                    <Lock size={18} className="mb-1 text-slate-400" />
                    <span className="block text-[10px] uppercase text-slate-400 font-extrabold">Étape 3</span>
                    <span className="text-[11px] font-bold">Activation</span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all"
                >
                  Retour à la page de connexion
                  <ArrowRight size={18} className="ml-2" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-8">
              {error && (
                <div className="rounded-2xl border border-red-200/60 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm font-medium text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* SECTION 1: Informations de connexion & Identité */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 font-black text-blue-600 dark:text-blue-400 text-base border-b border-slate-200 dark:border-slate-800 pb-2">
                  <User size={18} />
                  <span>1. Identité & Connexion</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Prénom *</label>
                    <input required name="first_name" value={formData.first_name} onChange={handleChange} placeholder="Moustapha" type="text" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Nom *</label>
                    <input required name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Diop" type="text" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Adresse Email *</label>
                    <input required name="email" value={formData.email} onChange={handleChange} placeholder="exemple@dmk.com" type="email" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Numéro de Téléphone</label>
                    <input name="phone" value={formData.phone} onChange={handleChange} placeholder="+221 77 000 00 00" type="tel" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Mot de passe *</label>
                    <div className="relative">
                      <input required name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" type={showPassword ? 'text' : 'password'} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3.5 pr-10 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Confirmer le mot de passe *</label>
                    <input required name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" type="password" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Secteur / Dahira</label>
                    <select name="sector" value={formData.sector} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500">
                      <option value="">Sélectionner un secteur</option>
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Sexe / Genre</label>
                    <select name="gender" value={formData.gender} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500">
                      <option value="Masculin">Masculin</option>
                      <option value="Féminin">Féminin</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Informations Personnelles & Administratives */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-2 font-black text-blue-600 dark:text-blue-400 text-base border-b border-slate-200 dark:border-slate-800 pb-2">
                  <FileText size={18} />
                  <span>2. Informations Personnelles & Administratives</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Date de naissance</label>
                    <input name="birth_date" value={formData.birth_date} onChange={handleChange} type="date" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Lieu de naissance</label>
                    <input name="birth_place" value={formData.birth_place} onChange={handleChange} placeholder="Ex: Dakar" type="text" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Profession</label>
                    <input name="profession" value={formData.profession} onChange={handleChange} placeholder="Ex: Enseignant" type="text" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Adresse complète</label>
                  <input name="address" value={formData.address} onChange={handleChange} placeholder="Adresse de résidence" type="text" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Numéro CNI</label>
                    <input name="cni_number" value={formData.cni_number} onChange={handleChange} placeholder="Numéro pièce d'identité" type="text" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Délivrance CNI</label>
                    <input name="cni_issue_date" value={formData.cni_issue_date} onChange={handleChange} type="date" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Expiration CNI</label>
                    <input name="cni_expiry_date" value={formData.cni_expiry_date} onChange={handleChange} type="date" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Groupe Sanguin</label>
                    <select name="blood_type" value={formData.blood_type} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500">
                      <option value="">Non spécifié</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Date d'adhésion</label>
                    <input name="join_date" value={formData.join_date} onChange={handleChange} type="date" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Engagements Financiers (Sass) */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-2 font-black text-blue-600 dark:text-blue-400 text-base border-b border-slate-200 dark:border-slate-800 pb-2">
                  <Coins size={18} />
                  <span>3. Engagements Financiers (Prévisions Sass FCFA)</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Magal/Gamou</label>
                    <input name="sass_magal" value={formData.sass_magal} onChange={handleChange} placeholder="0" type="number" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Ziaar</label>
                    <input name="sass_ziaar" value={formData.sass_ziaar} onChange={handleChange} placeholder="0" type="number" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Keur Serigne Touba</label>
                    <input name="sass_kst" value={formData.sass_kst} onChange={handleChange} placeholder="0" type="number" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Cahier S. Mountakha</label>
                    <input name="sass_cahier" value={formData.sass_cahier} onChange={handleChange} placeholder="0" type="number" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Projets</label>
                    <input name="sass_projets" value={formData.sass_projets} onChange={handleChange} placeholder="0" type="number" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Autres</label>
                    <input name="sass_autres" value={formData.sass_autres} onChange={handleChange} placeholder="0" type="number" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 p-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>

              {/* SECTION 4: POLITIQUE DE CONFIDENTIALITÉ ET CONDITIONS */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-start space-x-3 bg-slate-100/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/50">
                  <input
                    type="checkbox"
                    id="terms_checkbox_member"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 w-5 h-5 accent-blue-600 rounded-lg cursor-pointer"
                  />
                  <label htmlFor="terms_checkbox_member" className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed cursor-pointer font-medium">
                    J'accepte la <button type="button" onClick={() => setShowTermsModal(true)} className="text-blue-600 dark:text-blue-400 font-bold underline hover:opacity-80">Politique de Confidentialité</button> et les <button type="button" onClick={() => setShowTermsModal(true)} className="text-blue-600 dark:text-blue-400 font-bold underline hover:opacity-80">Conditions d'Utilisation</button> du système DMK. Mes données personnelles seront traitées de manière sécurisée et confidentielle. *
                  </label>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <FileCheck size={14} className="mr-1.5" />
                    Consulter la Politique de Confidentialité & Conditions
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !acceptedTerms}
                className="mt-6 flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-4 text-center text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {loading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                ) : (
                  <>
                    Soumettre mon inscription
                    <ArrowRight size={18} className="ml-2" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* MODAL POLITIQUE DE CONFIDENTIALITÉ ET CONDITIONS */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative text-slate-900 dark:text-white">
            <button
              onClick={() => setShowTermsModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Politique & Conditions DMK</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Système d'Information DMK • Protection & Confidentialité</p>
              </div>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400 pr-1 custom-scrollbar">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <h4 className="font-extrabold text-slate-900 dark:text-white mb-1 text-sm">1. Protection des données personnelles</h4>
                <p>
                  Les informations recueillies (nom, prénom, CNI, téléphone, adresse, engagements financiers) font l'objet d'un traitement sécurisé. Elles sont exclusivement destinées à la gestion interne des membres et des activités de l'organisation DMK.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <h4 className="font-extrabold text-slate-900 dark:text-white mb-1 text-sm">2. Confidentialité & Sécurité</h4>
                <p>
                  Vos informations ne seront en aucun cas transmises ni vendues à des tiers. Les mots de passe et données sensibles sont stockés selon les standards de sécurité actuels pour empêcher tout accès non autorisé.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <h4 className="font-extrabold text-slate-900 dark:text-white mb-1 text-sm">3. Processus de validation des comptes (48h)</h4>
                <p>
                  Toute nouvelle demande d'inscription est soumise avec le statut <strong>"En attente"</strong>. Le bureau administrateur étudie chaque dossier et procède à sa validation dans un délai maximum de <strong>48 heures</strong>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <h4 className="font-extrabold text-slate-900 dark:text-white mb-1 text-sm">4. Engagements des membres</h4>
                <p>
                  En soumettant cette demande, le membre s'engage à fournir des informations exactes et à respecter le règlement intérieur et les valeurs morales de l'organisation DMK.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  setAcceptedTerms(true);
                  setShowTermsModal(false);
                }}
                className="bg-blue-600 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-md"
              >
                J'accepte les conditions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
