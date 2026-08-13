import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Users, Calendar, Clock, MapPin, CheckCircle, Plus, X, CalendarDays, FileText, ChevronRight, Briefcase, Video, Maximize2, ExternalLink, ShieldCheck, Settings, UserCheck, Trash2, Radio, Play } from 'lucide-react';

function getEmbedUrl(url: string): string {
  if (!url) return url;
  const ytShort = url.match(/youtu\.be\/([\w-]+)/);
  if (ytShort) return `https://www.youtube-nocookie.com/embed/${ytShort[1]}?autoplay=1`;
  const ytWatch = url.match(/youtube\.com\/watch\?.*v=([\w-]+)/);
  if (ytWatch) return `https://www.youtube-nocookie.com/embed/${ytWatch[1]}?autoplay=1`;
  if (url.includes('youtube.com/embed') || url.includes('youtube-nocookie.com/embed')) return url;
  // Daily.co — embeddable as-is
  if (url.includes('daily.co')) return url;
  return url;
}

function getLiveType(url: string): 'jitsi' | 'youtube' | 'tiktok' | 'daily' | 'other' {
  if (!url) return 'other';
  if (url.includes('jit.si') || url.includes('jitsi')) return 'jitsi';
  if (url.includes('youtube') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok')) return 'tiktok';
  if (url.includes('daily.co')) return 'daily';
  return 'other';
}

interface MeetingParticipant {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

interface BureauMeeting {
  id: string;
  title: string;
  date_time: string;
  location?: string | null;
  agenda?: string | null;
  maps_link?: string | null;
  meet_url?: string | null;
  is_online?: boolean;
}

export default function Bureau() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [canCreate, setCanCreate] = useState(false);
  const [canManage, setCanManage] = useState(false);
  
  const [upcomingMeetings, setUpcomingMeetings] = useState<BureauMeeting[]>([]);
  const [pastMeetings, setPastMeetings] = useState<BureauMeeting[]>([]);
  const [myAttendances, setMyAttendances] = useState<string[]>([]);
  const [activeVisio, setActiveVisio] = useState<{ id: string; title: string; url: string } | null>(null);
  const [selectedPastMeeting, setSelectedPastMeeting] = useState<BureauMeeting | null>(null);

  // Modal Planifier
  const [isModalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mTitle, setMTitle] = useState('');
  const [mDate, setMDate] = useState('');
  const [mTime, setMTime] = useState('');
  const [mLocation, setMLocation] = useState('');
  const [mAgenda, setMAgenda] = useState('');

  // Modal Gestion Réunion
  const [managedMeeting, setManagedMeeting] = useState<BureauMeeting | null>(null);
  const [manageTab, setManageTab] = useState<'membres' | 'presences' | 'suivi'>('presences');
  const [bureauMembers, setBureauMembers] = useState<MeetingParticipant[]>([]);
  const [confirmedAttendees, setConfirmedAttendees] = useState<MeetingParticipant[]>([]);
  const [liveViewers, setLiveViewers] = useState<MeetingParticipant[]>([]);
  const [loadingManage, setLoadingManage] = useState(false);

  const fetchBureauData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get current user role
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        const { data: profile } = await supabase
          .from('members')
          .select('role')
          .eq('email', session.user.email)
          .single();
          
        if (profile?.role) {
          const roleStr = profile.role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          setUserRole(profile.role);
          const creatorsNormalized = [
            'secretaire general', 'secretaire generale',
            'presidence (dg/sg)', 'dieuwrigne', 'vice-dieuwrigne',
            'vice dieuwrigne', 'membre bureau', 'tresorier',
            'tresorier general', 'tresoriere', 'sage', 'commissaire au compte'
          ];
          if (creatorsNormalized.includes(roleStr)) {
            setCanCreate(true);
          }

          // Seul l'administrateur (ou présidence/SG) a le pouvoir de gérer les réunions
          const adminNormalized = [
            'admin',
            'administrateur',
            'administrateur general',
            'admin general',
            'super admin',
            'presidence (dg/sg)',
            'secretaire general',
            'secretaire generale'
          ];
          if (adminNormalized.some(r => roleStr.includes(r))) {
            setCanManage(true);
          }
        }
      }

      // 2. Fetch Meetings — explicit order + high limit to avoid default Supabase truncation
      const { data: meetings, error: meetErr } = await supabase
        .from('bureau_meetings')
        .select('*')
        .order('date_time', { ascending: true })
        .limit(1000);

      if (meetErr) console.warn("bureau_meetings non accessible (RLS ou table manquante):", meetErr.message);

      const { data: generalEvents } = await supabase
        .from('events')
        .select('*')
        .in('event_type', ['Bureau', 'Réunion Bureau'])
        .order('event_date', { ascending: true })
        .limit(1000);

      let combinedMeetings: BureauMeeting[] = [];

      if (meetings && meetings.length > 0) combinedMeetings = [...meetings];

      if (generalEvents) {
        const mappedEvents: BureauMeeting[] = generalEvents.map(e => ({
          id: e.id,
          title: e.title,
          date_time: e.event_date,
          location: e.location,
          agenda: e.description,
          maps_link: e.maps_link,
          meet_url: e.meet_url,
          is_online: e.is_online || Boolean(e.meet_url)
        }));
        
        const existingIds = new Set(combinedMeetings.map(m => m.id));
        mappedEvents.forEach(me => {
          if (!existingIds.has(me.id)) combinedMeetings.push(me);
        });
      }

      combinedMeetings.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

      const now = new Date();
      setUpcomingMeetings(combinedMeetings.filter(m => new Date(m.date_time) >= now));
      setPastMeetings(combinedMeetings.filter(m => new Date(m.date_time) < now).reverse());

      // 4. Fetch Attendances
      if (session?.user?.email) {
        const { data: attData } = await supabase
          .from('attendances')
          .select('meeting_id')
          .eq('member_email', session.user.email);
          
        if (attData) setMyAttendances(attData.map(a => a.meeting_id));
      }

    } catch (error) {
      console.error("Erreur Bureau:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBureauData();

    const channel = supabase
      .channel('bureau_member_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bureau_meetings' }, () => fetchBureauData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchBureauData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_attendances' }, () => fetchBureauData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, () => fetchBureauData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_viewers' }, () => fetchBureauData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchBureauData]);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTitle || !mDate || !mTime || !mLocation) {
      window.alert("Veuillez remplir le titre, la date, l'heure et le lieu.");
      return;
    }

    try {
      setIsSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const dateTimeStr = `${mDate}T${mTime}:00`;
      const meetingDate = new Date(dateTimeStr);
      
      if (isNaN(meetingDate.getTime())) {
        window.alert("Format de date (AAAA-MM-JJ) ou d'heure (HH:MM) invalide.");
        setIsSubmitting(false);
        return;
      }

      // Tentative 1 : bureau_meetings (nécessite RLS is_secretaire)
      const { error: bureauErr } = await supabase
        .from('bureau_meetings')
        .insert({
          title: mTitle.trim(),
          date_time: meetingDate.toISOString(),
          location: mLocation.trim(),
          agenda: mAgenda.trim() || null,
          created_by: session?.user?.id
        });

      if (bureauErr) {
        // Fallback : insert dans events avec type "Réunion Bureau"
        console.warn("bureau_meetings bloqué (RLS), fallback vers events:", bureauErr.message);
        const { error: evtErr } = await supabase
          .from('events')
          .insert({
            title: mTitle.trim(),
            event_date: meetingDate.toISOString(),
            location: mLocation.trim(),
            description: mAgenda.trim() || null,
            event_type: 'Réunion Bureau',
            created_by: session?.user?.id
          });
        if (evtErr) throw new Error(evtErr.message);
      }

      window.alert("Réunion planifiée avec succès !");
      setModalVisible(false);
      setMTitle(''); setMDate(''); setMTime(''); setMLocation(''); setMAgenda('');
      
      fetchBureauData();
    } catch (error) {
      console.error("Erreur création réunion:", error);
      window.alert("Erreur lors de la planification : " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPresence = async (meetingId: string) => {
    try {
      if (myAttendances.includes(meetingId)) return;
      
      const { error } = await supabase
        .from('attendances')
        .insert([{ meeting_id: meetingId, member_email: userEmail }]);
        
      if (error) throw error;
      
      setMyAttendances([...myAttendances, meetingId]);
      window.alert("Votre présence a été confirmée !");
    } catch (err) {
      console.error(err);
      window.alert("Erreur lors de la confirmation.");
    }
  };

  // ── GESTION RÉUNION : ouvrir le panneau et charger les données ──
  const openManageMeeting = async (meeting: BureauMeeting) => {
    setManagedMeeting(meeting);
    setManageTab('presences');
    setLoadingManage(true);
    setBureauMembers([]);
    setConfirmedAttendees([]);
    setLiveViewers([]);

    try {
      const bureauRoles = ['Membre Bureau', 'Secrétaire Général', 'Secrétaire Générale', 'Présidence (DG/SG)', 'Dieuwrigne', 'Vice-Dieuwrigne', 'Vice Dieuwrigne', 'Trésorier', 'Trésorier Général', 'Trésorière', 'Sage', 'Commissaire au compte'];

      // 1. Membres du Bureau
      const { data: bm } = await supabase
        .from('members')
        .select('id, full_name, email, role, avatar_url')
        .in('role', bureauRoles)
        .order('full_name');
      if (bm) setBureauMembers(bm as MeetingParticipant[]);

      // 2. Présences confirmées pour cette réunion
      const { data: att } = await supabase
        .from('attendances')
        .select('member_email')
        .eq('meeting_id', meeting.id.toString());

      if (att && att.length > 0) {
        const emails = att.map((a: { member_email: string }) => a.member_email);
        const { data: attendeeProfiles } = await supabase
          .from('members')
          .select('id, full_name, email, role, avatar_url')
          .in('email', emails);
        if (attendeeProfiles) setConfirmedAttendees(attendeeProfiles as MeetingParticipant[]);
      }

      // 3. Suivi en direct (meeting_viewers si la table existe)
      const { data: viewers } = await supabase
        .from('meeting_viewers')
        .select('member_email, joined_at')
        .eq('meeting_id', meeting.id.toString())
        .order('joined_at', { ascending: false });

      if (viewers && viewers.length > 0) {
        const vEmails = viewers.map((v: { member_email: string }) => v.member_email);
        const { data: viewerProfiles } = await supabase
          .from('members')
          .select('id, full_name, email, role, avatar_url')
          .in('email', vEmails);
        if (viewerProfiles) setLiveViewers(viewerProfiles as MeetingParticipant[]);
      }
    } catch (err) {
      console.warn("Erreur chargement gestion réunion:", err);
    } finally {
      setLoadingManage(false);
    }
  };

  const handleDeleteMeeting = async (meeting: BureauMeeting) => {
    if (!window.confirm(`Supprimer la réunion "${meeting.title}" ?`)) return;
    try {
      const { error } = await supabase
        .from('bureau_meetings')
        .delete()
        .eq('id', meeting.id);
      if (error) throw error;
      setManagedMeeting(null);
      fetchBureauData();
    } catch (err) {
      console.error(err);
      window.alert("Erreur lors de la suppression.");
    }
  };

  const handleJoinVisio = async (meeting: BureauMeeting) => {
    setActiveVisio({ id: meeting.id.toString(), title: meeting.title, url: meeting.meet_url || '' });
    if (userEmail) {
      try {
        await supabase.from('meeting_viewers').upsert({
          meeting_id: meeting.id.toString(),
          member_email: userEmail,
          joined_at: new Date().toISOString()
        }, { onConflict: 'meeting_id,member_email' });
      } catch (e) {
        console.warn("Erreur inscription spectateur direct:", e);
      }
    }
  };

  const handleLeaveVisio = async () => {
    if (activeVisio?.id && userEmail) {
      try {
        await supabase.from('meeting_viewers').delete().match({
          meeting_id: activeVisio.id,
          member_email: userEmail
        });
      } catch (e) {
        console.warn("Erreur désinscription spectateur direct:", e);
      }
    }
    setActiveVisio(null);
  };



  if (loading && upcomingMeetings.length === 0 && pastMeetings.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center relative z-10">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600/30 border-t-blue-600 drop-shadow-md"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col relative pb-40 md:pb-8">
      {/* Header */}
      <div className="p-6 md:p-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Le Bureau</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium md:text-lg transition-colors">Coordination Stratégique</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-[20px] bg-blue-600/90 px-4 py-2 text-white shadow-lg shadow-blue-500/30 border border-white/20">
          <Briefcase size={16} />
          <span className="text-sm font-bold">{userRole || 'Membre'}</span>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-8 max-w-4xl w-full mx-auto space-y-8">
        
        {/* STATS PREMIUM */}
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-[32px] bg-white/60 dark:bg-slate-900/50 p-6 md:p-8 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 border border-white/50 dark:border-slate-700/50 transition-all hover:-translate-y-1 hover:shadow-xl group">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-green-100 dark:bg-green-500/20 shadow-inner group-hover:scale-110 transition-transform">
              <CalendarDays size={26} className="text-green-600 dark:text-green-400 drop-shadow-sm" />
            </div>
            <div className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">{upcomingMeetings.length}</div>
            <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors">Réunions à venir</div>
          </div>
        </div>

        {/* PROCHAINES REUNIONS */}
        <div>
          <div className="mb-5 ml-2 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Prochaines Réunions</h2>
            {canCreate && (
              <button 
                onClick={() => setModalVisible(true)}
                className="flex items-center gap-2 rounded-[20px] bg-slate-900 dark:bg-white px-4 py-2 text-sm font-bold text-white dark:text-slate-900 transition-all hover:bg-slate-800 dark:hover:bg-slate-200 shadow-md active:scale-95"
              >
                <Plus size={16} /> Planifier
              </button>
            )}
          </div>

          {upcomingMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 p-10 text-center shadow-inner transition-colors">
              <Calendar size={48} className="mb-4 text-slate-400 dark:text-slate-500 drop-shadow-sm" />
              <p className="text-base font-black text-slate-700 dark:text-slate-300 transition-colors">Aucune réunion planifiée.</p>
              {canCreate && <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors">Cliquez sur "Planifier" pour en créer une.</p>}
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMeetings.map(meeting => {
                const dt = parseISO(meeting.date_time);
                const isConfirmed = myAttendances.includes(meeting.id.toString());
                
                return (
                  <div key={meeting.id} className="rounded-[32px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 md:p-8 shadow-2xl shadow-slate-300/50 dark:shadow-black/70 transition-all hover:shadow-2xl relative z-10">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="rounded-[16px] border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 text-xs sm:text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider shadow-sm">
                        {format(dt, 'EEE d MMM yyyy', { locale: fr })}
                      </div>
                      <div className="flex items-center gap-2 rounded-[16px] bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-500/30 px-4 py-2 shadow-sm">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">À venir</span>
                      </div>
                    </div>
                    
                    <h3 className="mb-5 text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight transition-colors">{meeting.title}</h3>
                    
                    <div className="mb-6 rounded-[24px] bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-4 sm:p-5 space-y-3 sm:space-y-4 shadow-sm">
                      <div className="flex items-center gap-4 text-slate-700 dark:text-slate-300 transition-colors">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white dark:bg-slate-700 shadow-sm">
                          <Clock size={20} className="text-slate-500 dark:text-slate-400" />
                        </div>
                        <span className="font-bold text-lg">{format(dt, 'HH:mm')}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-700 dark:text-slate-300 transition-colors">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white dark:bg-slate-700 shadow-sm">
                          <MapPin size={20} className="text-slate-500 dark:text-slate-400" />
                        </div>
                        <span className="font-bold text-base leading-tight">{meeting.location}</span>
                      </div>
                      {meeting.agenda && (
                        <div className="flex items-start gap-4 text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 transition-colors">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white dark:bg-slate-700 shadow-sm mt-1">
                            <FileText size={20} className="text-slate-500 dark:text-slate-400" />
                          </div>
                          <span className="font-medium mt-2 leading-relaxed">{meeting.agenda}</span>
                        </div>
                      )}
                    </div>

                    {meeting.meet_url && (
                      <button 
                        onClick={() => handleJoinVisio(meeting)}
                        className="mb-4 inline-flex items-center justify-center gap-2 w-full rounded-[20px] bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-700 hover:to-teal-700 transition-all active:scale-95"
                      >
                        <Video size={18} className="animate-pulse" />
                        Rejoindre le Direct (Dans l'Appli)
                      </button>
                    )}

                    {meeting.maps_link && (
                      <a 
                        href={meeting.maps_link} target="_blank" rel="noreferrer"
                        className="mb-4 inline-flex items-center gap-2 rounded-[16px] bg-sky-50/80 dark:bg-sky-900/20 border border-sky-200/50 dark:border-sky-500/30 px-5 py-3 text-sm font-black text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-all active:scale-95 shadow-sm"
                      >
                        <MapPin size={18} /> Voir l'itinéraire
                      </a>
                    )}

                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleConfirmPresence(meeting.id.toString())}
                        disabled={isConfirmed}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-[20px] px-4 py-4 text-base font-black transition-all active:scale-95 ${
                          isConfirmed 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                            : 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-600/40'
                        }`}
                      >
                        <CheckCircle size={20} />
                        {isConfirmed ? "Présence confirmée" : "Confirmer ma présence"}
                      </button>

                      {canManage && (
                        <button
                          onClick={() => openManageMeeting(meeting)}
                          className="flex items-center justify-center gap-2 rounded-[20px] bg-slate-100 dark:bg-slate-800 px-5 py-4 text-base font-black text-slate-700 dark:text-slate-200 transition-all active:scale-95 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-md border border-slate-200/50 dark:border-slate-700/50"
                          title="Gérer la réunion"
                        >
                          <Settings size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* HISTORIQUE */}
        {pastMeetings.length > 0 && (
          <div>
            <h2 className="mb-5 ml-2 text-xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Historique des Réunions</h2>
            <div className="space-y-3">
              {pastMeetings.map(meeting => {
                const dt = parseISO(meeting.date_time);
                return (
                  <div 
                    key={meeting.id} 
                    onClick={() => setSelectedPastMeeting(meeting)}
                    className="flex items-center justify-between rounded-[24px] bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-md shadow-slate-200/50 dark:shadow-black/50 border border-slate-200/80 dark:border-slate-800 transition-all hover:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer active:scale-98 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-emerald-50/80 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shadow-inner border border-emerald-200/50 dark:border-emerald-500/30">
                        <CheckCircle size={26} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-base transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">{meeting.title}</h4>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 capitalize mt-1 tracking-wide transition-colors">
                          {format(dt, "EEE d MMM yyyy • HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {meeting.meet_url && (
                        <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/30" title="Visioconférence disponible">
                          <Video size={18} />
                        </span>
                      )}
                      <ChevronRight size={24} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal Planifier */}
      {isModalVisible && (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-slate-900/75 dark:bg-black/80 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full sm:max-w-md bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 p-6 md:p-8 pb-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Planifier</h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">Nouvelle réunion du bureau</p>
              </div>
              <button onClick={() => setModalVisible(false)} className="rounded-full bg-slate-100/50 dark:bg-slate-800/50 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateMeeting} className="p-6 md:p-8 pt-4 space-y-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Titre de la réunion</label>
                <input type="text" required value={mTitle} onChange={e => setMTitle(e.target.value)} placeholder="Ex: CA Trimestriel..." className="w-full rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 px-4 py-4 text-base font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Date</label>
                  <input type="date" required value={mDate} onChange={e => setMDate(e.target.value)} className="w-full rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 px-4 py-4 text-base font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Heure</label>
                  <input type="time" required value={mTime} onChange={e => setMTime(e.target.value)} className="w-full rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 px-4 py-4 text-base font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Lieu ou Lien (Meet)</label>
                <input type="text" required value={mLocation} onChange={e => setMLocation(e.target.value)} placeholder="Ex: Keur Serigne Touba" className="w-full rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 px-4 py-4 text-base font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Ordre du jour</label>
                <textarea rows={3} value={mAgenda} onChange={e => setMAgenda(e.target.value)} placeholder="1. Bilan mensuel..." className="w-full rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 px-4 py-4 text-base font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"></textarea>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-[20px] bg-slate-900 dark:bg-white px-4 py-4 text-base font-black text-white dark:text-slate-900 shadow-xl shadow-slate-900/20 dark:shadow-white/20 transition-all hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-70 active:scale-95"
              >
                {isSubmitting ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div> : <CheckCircle size={20} />}
                {isSubmitting ? 'Planification...' : 'Valider la réunion'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL LECTEUR LIVE INTÉGRÉ (Jitsi / YouTube / TikTok) ── */}
      {activeVisio && (
        <div
          className="fixed inset-0 z-[99999] flex flex-col bg-black"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 md:px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0"
            style={{ zIndex: 1, position: 'relative' }}
          >
            <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping flex-shrink-0"></div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white truncate">{activeVisio.title}</h3>
                <p className="text-[10px] font-bold flex items-center gap-1"
                  style={{
                    color: getLiveType(activeVisio.url) === 'youtube' ? '#ff4444'
                      : getLiveType(activeVisio.url) === 'tiktok' ? '#69c9d0'
                      : getLiveType(activeVisio.url) === 'daily' ? '#4f46e5'
                      : '#10b981'
                  }}
                >
                  {getLiveType(activeVisio.url) === 'youtube' && <Play size={11} className="flex-shrink-0" />}
                  {getLiveType(activeVisio.url) === 'tiktok' && <Play size={11} className="flex-shrink-0" />}
                  {getLiveType(activeVisio.url) === 'daily' && <Video size={11} className="flex-shrink-0" />}
                  {getLiveType(activeVisio.url) === 'jitsi' && <ShieldCheck size={11} className="mr-1 flex-shrink-0" />}
                  <span className="truncate">
                    {getLiveType(activeVisio.url) === 'youtube' ? '🔴 Live YouTube DMK' :
                     getLiveType(activeVisio.url) === 'tiktok' ? '🔴 Live TikTok DMK' :
                     getLiveType(activeVisio.url) === 'daily' ? '🟣 Réunion DMK (Daily.co)' :
                     '🟢 Visioconférence Bureau DMK en direct'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 flex-shrink-0">
              {(getLiveType(activeVisio.url) === 'jitsi' || getLiveType(activeVisio.url) === 'daily') && (
                <button
                  onClick={() => {
                    const el = document.getElementById('visio-iframe-bureau');
                    if (el) {
                      if (!document.fullscreenElement) {
                        el.requestFullscreen?.();
                      } else {
                        document.exitFullscreen?.();
                      }
                    }
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors touch-manipulation"
                  title="Plein Écran"
                >
                  <Maximize2 size={18} />
                </button>
              )}
              <a
                href={activeVisio.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors touch-manipulation"
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink size={16} />
              </a>
              <button
                onClick={handleLeaveVisio}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-600/30 hover:bg-red-600 text-red-400 hover:text-white transition-colors touch-manipulation"
                title="Fermer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Contenu */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
            {getLiveType(activeVisio.url) === 'tiktok' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white p-8 text-center gap-6">
                <div className="text-6xl">🎵</div>
                <div>
                  <h3 className="text-xl font-black mb-2">Live TikTok DMK</h3>
                  <p className="text-slate-300 text-sm font-medium mb-6">TikTok ne permet pas la lecture directe dans une autre application. Ouvrez le live dans TikTok.</p>
                  <a
                    href={activeVisio.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black text-base shadow-lg shadow-pink-500/30 hover:scale-105 transition-transform"
                  >
                    <ExternalLink size={18} />
                    Ouvrir le Live TikTok
                  </a>
                </div>
              </div>
            ) : (
              <iframe
                id="visio-iframe-bureau"
                src={getEmbedUrl(activeVisio.url)}
                allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen; picture-in-picture"
                className="absolute inset-0 w-full h-full border-0"
                title="Live DMK en Direct"
                style={{ touchAction: 'manipulation' }}
                allowFullScreen
              />
            )}
          </div>
        </div>
      )}

      {/* ── MODAL GESTION RÉUNION ── */}
      {managedMeeting && (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-slate-900/75 dark:bg-black/80 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full sm:max-w-lg bg-white/95 dark:bg-slate-900/95 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300 max-h-[92vh]">
            
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Gestion Réunion</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate">{managedMeeting.title}</h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                  {format(parseISO(managedMeeting.date_time), "EEE d MMM yyyy • HH:mm", { locale: fr })}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <button
                  onClick={() => handleDeleteMeeting(managedMeeting)}
                  className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  title="Supprimer la réunion"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={() => setManagedMeeting(null)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-4 shrink-0">
              {([
                { key: 'presences', label: 'Présences', icon: <UserCheck size={15} />, count: confirmedAttendees.length },
                { key: 'membres', label: 'Bureau', icon: <Users size={15} />, count: bureauMembers.length },
                { key: 'suivi', label: 'En Direct', icon: <Radio size={15} />, count: liveViewers.length },
              ] as { key: 'presences' | 'membres' | 'suivi'; label: string; icon: React.ReactNode; count: number }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setManageTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-black transition-all ${
                    manageTab === tab.key
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <span className={`ml-0.5 text-[11px] rounded-full px-1.5 py-0.5 font-black ${
                    manageTab === tab.key ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar">
              {loadingManage ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600/20 border-t-blue-600"></div>
                </div>
              ) : (
                <>
                  {/* TAB : PRÉSENCES CONFIRMÉES */}
                  {manageTab === 'presences' && (
                    confirmedAttendees.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <CheckCircle size={40} className="mb-3 text-slate-300 dark:text-slate-600" />
                        <p className="font-black text-slate-500 dark:text-slate-400">Aucune présence confirmée</p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Les membres n'ont pas encore confirmé.</p>
                      </div>
                    ) : (
                      confirmedAttendees.map(m => (
                        <div key={m.id} className="flex items-center gap-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 px-4 py-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-black text-sm shrink-0 overflow-hidden">
                            {m.avatar_url ? <img src={m.avatar_url} alt={m.full_name} className="w-full h-full object-cover" /> : m.full_name?.charAt(0) ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-900 dark:text-white text-sm truncate">{m.full_name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.role}</p>
                          </div>
                          <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                        </div>
                      ))
                    )
                  )}

                  {/* TAB : MEMBRES DU BUREAU */}
                  {manageTab === 'membres' && (
                    bureauMembers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Users size={40} className="mb-3 text-slate-300 dark:text-slate-600" />
                        <p className="font-black text-slate-500 dark:text-slate-400">Aucun membre du bureau trouvé</p>
                      </div>
                    ) : (
                      bureauMembers.map(m => {
                        const hasConfirmed = confirmedAttendees.some(a => a.email === m.email);
                        return (
                          <div key={m.id} className="flex items-center gap-4 rounded-2xl bg-white/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 px-4 py-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-black text-sm shrink-0 overflow-hidden">
                              {m.avatar_url ? <img src={m.avatar_url} alt={m.full_name} className="w-full h-full object-cover" /> : m.full_name?.charAt(0) ?? '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-slate-900 dark:text-white text-sm truncate">{m.full_name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.role}</p>
                            </div>
                            {hasConfirmed
                              ? <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full shrink-0">✓ Confirmé</span>
                              : <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full shrink-0">En attente</span>
                            }
                          </div>
                        );
                      })
                    )
                  )}

                  {/* TAB : SUIVI EN DIRECT */}
                  {manageTab === 'suivi' && (
                    liveViewers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Radio size={40} className="mb-3 text-slate-300 dark:text-slate-600" />
                        <p className="font-black text-slate-500 dark:text-slate-400">Aucun spectateur en direct</p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Les membres qui rejoignent la visio apparaîtront ici.</p>
                      </div>
                    ) : (
                      liveViewers.map(m => (
                        <div key={m.id} className="flex items-center gap-4 rounded-2xl bg-violet-50/60 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-800/30 px-4 py-3">
                          <div className="relative w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 dark:text-violet-400 font-black text-sm shrink-0 overflow-hidden">
                            {m.avatar_url ? <img src={m.avatar_url} alt={m.full_name} className="w-full h-full object-cover" /> : m.full_name?.charAt(0) ?? '?'}
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-red-500 border-2 border-white dark:border-slate-900 animate-pulse"></span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-900 dark:text-white text-sm truncate">{m.full_name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.role}</p>
                          </div>
                          <span className="text-[11px] font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block"></span>
                            Live
                          </span>
                        </div>
                      ))
                    )
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                onClick={() => setManagedMeeting(null)}
                className="w-full rounded-[20px] bg-slate-100 dark:bg-slate-800 px-4 py-3.5 text-base font-black text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL DÉTAILS RÉUNION HISTORIQUE ── */}
      {selectedPastMeeting && (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-slate-900/75 dark:bg-black/80 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full sm:max-w-md bg-white/95 dark:bg-slate-900/95 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 p-6 pb-4">
              <div>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Réunion Passée</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">{selectedPastMeeting.title}</h3>
              </div>
              <button 
                onClick={() => setSelectedPastMeeting(null)} 
                className="rounded-full bg-slate-100/50 dark:bg-slate-800/50 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3 border border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <Clock size={18} className="text-slate-400" />
                  <span className="font-bold text-sm">
                    {format(parseISO(selectedPastMeeting.date_time), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </span>
                </div>
                {selectedPastMeeting.location && (
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <MapPin size={18} className="text-slate-400 shrink-0" />
                    <span className="font-bold text-sm">{selectedPastMeeting.location}</span>
                  </div>
                )}
                {selectedPastMeeting.agenda && (
                  <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Ordre du jour</p>
                    <p className="text-sm font-medium">{selectedPastMeeting.agenda}</p>
                  </div>
                )}
              </div>

              {selectedPastMeeting.meet_url && (
                <button 
                  onClick={() => {
                    const m = selectedPastMeeting;
                    setSelectedPastMeeting(null);
                    handleJoinVisio(m);
                  }}
                  className="inline-flex items-center justify-center gap-2 w-full rounded-[20px] bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-700 hover:to-teal-700 transition-all active:scale-95"
                >
                  <Video size={18} className="animate-pulse" />
                  Rejoindre / Rediffusion Visio (Dans l'Appli)
                </button>
              )}

              {selectedPastMeeting.maps_link && (
                <a 
                  href={selectedPastMeeting.maps_link} target="_blank" rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full rounded-[20px] bg-sky-50 dark:bg-sky-900/20 border border-sky-200/50 dark:border-sky-500/30 px-5 py-3 text-sm font-black text-sky-600 dark:text-sky-400 transition-all active:scale-95"
                >
                  <MapPin size={18} /> Voir l'itinéraire
                </a>
              )}

              {canManage && (
                <button 
                  onClick={() => {
                    const m = selectedPastMeeting;
                    setSelectedPastMeeting(null);
                    openManageMeeting(m);
                  }}
                  className="inline-flex items-center justify-center gap-2 w-full rounded-[20px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-5 py-3 text-sm font-black transition-all active:scale-95 border border-slate-200/50 dark:border-slate-700/50"
                >
                  <Settings size={18} /> Gérer la réunion &amp; les présences
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
