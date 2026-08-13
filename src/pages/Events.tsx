import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MapPin, Clock, Calendar as CalendarIcon, Bell, Video, X, ExternalLink, Maximize2, ShieldCheck, Settings, Users, CheckCircle, Radio, Trash2, UserCheck, Play } from 'lucide-react';

// Convert share/watch links to embeddable URLs
function getEmbedUrl(url: string): string {
  if (!url) return url;
  // youtu.be/VIDEO_ID or youtube.com/watch?v=VIDEO_ID → youtube-nocookie.com/embed/VIDEO_ID
  const ytShort = url.match(/youtu\.be\/([\w-]+)/);
  if (ytShort) return `https://www.youtube-nocookie.com/embed/${ytShort[1]}?autoplay=1`;
  const ytWatch = url.match(/youtube\.com\/watch\?.*v=([\w-]+)/);
  if (ytWatch) return `https://www.youtube-nocookie.com/embed/${ytWatch[1]}?autoplay=1`;
  // Already embed
  if (url.includes('youtube.com/embed') || url.includes('youtube-nocookie.com/embed')) return url;
  // Daily.co — embeddable as-is, no conversion needed
  if (url.includes('daily.co')) return url;
  // TikTok live — cannot be embedded, return as-is (will open externally)
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

type EventItem = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  date_time?: string;
  location: string | null;
  description: string | null;
  maps_link: string | null;
  meet_url?: string | null;
  is_online?: boolean;
};

interface MeetingParticipant {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

export default function Events() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [pastEvents, setPastEvents] = useState<EventItem[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [activeVisio, setActiveVisio] = useState<{ id: string; title: string; url: string } | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Modal Gestion Réunion / Visio
  const [managedMeeting, setManagedMeeting] = useState<EventItem | null>(null);
  const [manageTab, setManageTab] = useState<'membres' | 'presences' | 'suivi'>('presences');
  const [bureauMembers, setBureauMembers] = useState<MeetingParticipant[]>([]);
  const [confirmedAttendees, setConfirmedAttendees] = useState<MeetingParticipant[]>([]);
  const [liveViewers, setLiveViewers] = useState<MeetingParticipant[]>([]);
  const [loadingManage, setLoadingManage] = useState(false);

  useEffect(() => {
    const checkUserPermissions = async () => {
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
    };
    checkUserPermissions();
  }, []);

  const openManageMeeting = async (meeting: EventItem) => {
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

      // 2. Présences confirmées pour cet événement
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

      // 3. Suivi en direct (meeting_viewers)
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
      console.warn("Erreur chargement gestion événement:", err);
    } finally {
      setLoadingManage(false);
    }
  };

  const handleDeleteEvent = async (eventItem: EventItem) => {
    if (!window.confirm(`Supprimer l'événement "${eventItem.title}" ?`)) return;
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventItem.id);
      if (error) throw error;
      setManagedMeeting(null);
      fetchEvents();
    } catch (err) {
      console.error(err);
      window.alert("Erreur lors de la suppression.");
    }
  };

  const handleJoinVisio = async (item: EventItem) => {
    setActiveVisio({ id: item.id, title: item.title, url: item.meet_url! });
    if (userEmail) {
      try {
        await supabase.from('meeting_viewers').upsert({
          meeting_id: item.id.toString(),
          member_email: userEmail,
          joined_at: new Date().toISOString()
        }, { onConflict: 'meeting_id,member_email' });
      } catch (e) {
        console.warn("Erreur spectateur:", e);
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
        console.warn("Erreur désinscription spectateur:", e);
      }
    }
    setActiveVisio(null);
  };

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString();

      // Événements à venir
      const { data: upcomingData, error: upcomingErr } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', today)
        .order('event_date', { ascending: true });

      if (upcomingErr) throw upcomingErr;
      if (upcomingData) setEvents(upcomingData as EventItem[]);

      // Historique des événements passés
      const { data: pastData, error: pastErr } = await supabase
        .from('events')
        .select('*')
        .lt('event_date', today)
        .order('event_date', { ascending: false });

      if (pastErr) console.warn("Erreur chargement historique événements:", pastErr);
      if (pastData) setPastEvents(pastData as EventItem[]);

    } catch (error) {
      console.error("Erreur récupération événements:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel('events_member_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, () => fetchEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_viewers' }, () => fetchEvents())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchEvents]);

  const getEventStyle = (type: string, isOnline?: boolean) => {
    if (isOnline) {
      return { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20 dark:border-emerald-500/30' };
    }
    switch (type) {
      case 'Assemblée Générale': 
        return { bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20 dark:border-red-500/30' };
      case 'Dahira Mensuel': 
        return { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20 dark:border-indigo-500/30' };
      case 'Réunion Bureau':
      case 'Bureau': 
        return { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20 dark:border-purple-500/30' };
      case 'Magal': 
        return { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20 dark:border-amber-500/30' };
      default: 
        return { bg: 'bg-sky-500/10 dark:bg-sky-500/20', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20 dark:border-sky-500/30' };
    }
  };

  const currentList = activeTab === 'upcoming' ? events : pastEvents;

  return (
    <div className="flex flex-col relative pb-40 md:pb-8 h-full min-h-[calc(100vh-80px)]">
      <div className="p-6 md:p-8 md:pb-4 pb-4">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Événements &amp; Réunions</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 md:text-lg transition-colors">Vos prochains rendez-vous, lives et historique des événements</p>
        
        {/* Navigation Onglets (À venir vs Historique) */}
        <div className="flex items-center gap-3 mt-6 border-b border-slate-200 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs md:text-sm font-black transition-all duration-300 ${
              activeTab === 'upcoming'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105'
                : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50'
            }`}
          >
            <CalendarIcon size={16} />
            À venir
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'upcoming' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {events.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs md:text-sm font-black transition-all duration-300 ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105'
                : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50'
            }`}
          >
            <Clock size={16} />
            Historique Passé
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {pastEvents.length}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-8 max-w-4xl w-full mx-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600/30 border-t-blue-600 drop-shadow-md"></div>
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col h-64 items-center justify-center text-center rounded-[32px] bg-white/60 dark:bg-slate-900/50 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white/50 dark:border-slate-700/50 p-8 transition-colors">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 shadow-inner">
              <CalendarIcon size={40} className="text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
              {activeTab === 'upcoming' ? 'Agenda Dégagé' : 'Historique vide'}
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-sm">
              {activeTab === 'upcoming'
                ? "Aucune réunion ni événement n'est programmé pour le moment."
                : "Aucun événement passé enregistré dans l'historique."}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {currentList.map((item, index) => {
              const eventDate = parseISO(item.event_date);
              const isOnline = item.is_online || Boolean(item.meet_url);
              const style = getEventStyle(item.event_type, isOnline);
              const isNext = activeTab === 'upcoming' && index === 0;
              const isPast = activeTab === 'history';

              return (
                <div 
                  key={item.id} 
                  className={`relative flex flex-col overflow-hidden rounded-[24px] bg-white dark:bg-slate-900 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 z-10 ${ 
                    isNext 
                      ? 'border-2 border-blue-600 dark:border-blue-500 shadow-2xl shadow-blue-500/20' 
                      : 'border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/60'
                  }`}
                >
                  {isNext && (
                    <div className="flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 py-1.5 text-[11px] font-black tracking-widest text-white shadow-sm">
                      <Bell size={14} className="mr-2 animate-pulse" /> PROCHAIN RENDEZ-VOUS
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center p-5 gap-4">
                    {/* Date Box */}
                    <div className={`flex h-[75px] w-[70px] flex-col items-center justify-center rounded-[20px] shadow-sm shrink-0 ${
                      isNext 
                        ? 'bg-blue-600 text-white shadow-blue-600/30' 
                        : isPast
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        : 'border border-white/60 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md'
                    }`}>
                      <span className={`text-xs font-black uppercase tracking-widest mb-0.5 ${isNext ? 'text-blue-200' : 'text-slate-500 dark:text-slate-400'}`}>
                        {format(eventDate, 'MMM', { locale: fr })}
                      </span>
                      <span className={`text-3xl font-black tracking-tighter ${isNext ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {format(eventDate, 'dd')}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <div className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[10px] font-black uppercase tracking-widest shadow-sm ${style.bg} ${style.border} ${style.text}`}>
                          {item.event_type}
                        </div>
                        {isOnline && !isPast && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block"></span>
                            🔴 Live DMK
                          </div>
                        )}
                        {isPast && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            Événement Passé
                          </div>
                        )}
                      </div>
                      
                      <h4 className="mb-2 text-lg font-black leading-snug text-slate-900 dark:text-white line-clamp-2 tracking-tight transition-colors">
                        {item.title}
                      </h4>

                      {item.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 font-medium line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      
                      <div className="space-y-1.5">
                        <div className="flex items-center text-xs font-bold text-slate-600 dark:text-slate-400 transition-colors">
                          <Clock size={15} className="mr-2 text-slate-400 dark:text-slate-500" />
                          {format(eventDate, "EEEE d MMMM 'à' HH:mm", { locale: fr })}
                        </div>
                        {item.location && (
                          <div className="flex items-center text-xs font-bold text-slate-600 dark:text-slate-400 transition-colors">
                            <MapPin size={15} className="mr-2 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span className="truncate">{item.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.meet_url && (
                          <button 
                            onClick={() => handleJoinVisio(item)}
                            className={`inline-flex items-center rounded-xl px-4 py-2.5 text-xs font-black tracking-wide text-white shadow-lg transition-all active:scale-95 ${
                              isPast
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-600/30 hover:from-blue-700 hover:to-indigo-700'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-600/30 hover:from-emerald-700 hover:to-teal-700'
                            }`}
                          >
                            <Video size={16} className="mr-2 animate-pulse" />
                            {isPast ? "Revoir le Live / Replay" : "Rejoindre le Direct (Dans l'Appli)"}
                          </button>
                        )}

                        {item.maps_link && (
                          <a 
                            href={item.maps_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95"
                          >
                            <MapPin size={14} className="mr-1.5 text-blue-500" />
                            Itinéraire
                          </a>
                        )}

                        {canManage && (
                          <button
                            onClick={() => openManageMeeting(item)}
                            className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95"
                            title="Gérer l'événement"
                          >
                            <Settings size={14} className="mr-1.5 text-slate-500" />
                            Gérer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Espace de défilement massif pour éviter le masquage par la barre de navigation et le FAB */}
            <div className="h-44 w-full shrink-0" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* ── MODAL LECTEUR VISIOCONFÉRENCE INTÉGRÉ SANS SORTIR DE L'APPLI ── */}
      {activeVisio && (
        <div
          className="fixed inset-0 z-[99999] flex flex-col bg-black"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Header — toujours accessible */}
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
                     '🟢 Visioconférence DMK en direct'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 flex-shrink-0">
              {(getLiveType(activeVisio.url) === 'jitsi' || getLiveType(activeVisio.url) === 'daily') && (
                <button
                  onClick={() => {
                    const el = document.getElementById('visio-iframe-events');
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

          {/* Contenu — iframe ou lien externe selon la plateforme */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
            {getLiveType(activeVisio.url) === 'tiktok' ? (
              // TikTok ne supporte pas l'embed direct → affichage d'un écran de redirection
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
                id="visio-iframe-events"
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

      {/* ── MODAL GESTION RÉUNION / ÉVÉNEMENT ── */}
      {managedMeeting && (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-slate-900/75 dark:bg-black/80 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full sm:max-w-lg bg-white/95 dark:bg-slate-900/95 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300 max-h-[92vh]">
            
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Gestion Événement & Visio</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate">{managedMeeting.title}</h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                  {format(parseISO(managedMeeting.event_date || managedMeeting.date_time || ''), "EEE d MMM yyyy • HH:mm", { locale: fr })}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <button
                  onClick={() => handleDeleteEvent(managedMeeting)}
                  className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  title="Supprimer l'événement"
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
    </div>
  );
}
