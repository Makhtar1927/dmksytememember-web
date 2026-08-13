import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from './supabase';
import { sendNativeNotification, scheduleEventReminderNotification } from '../utils/capacitorNative';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { NotificationContext, type CommunicationItem } from './NotificationContextDef';

export function NotificationProvider({ children, memberId }: { children: ReactNode; memberId: string | null }) {
  const [notifications, setNotifications] = useState<CommunicationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommunications = useCallback(async (withLoadingState = false) => {
    if (!memberId) return;
    if (withLoadingState) {
      setLoading(true);
    }
    try {
      const storedReadIds = localStorage.getItem('read_notifications');
      if (storedReadIds) setReadIds(JSON.parse(storedReadIds) as string[]);

      const storedDeletedIds = localStorage.getItem('deleted_notifications');
      if (storedDeletedIds) setDeletedIds(JSON.parse(storedDeletedIds) as string[]);

      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .or(`recipient_id.is.null,recipient_id.eq.${memberId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setNotifications(data as CommunicationItem[]);
    } catch (err) {
      console.error("Erreur de chargement des notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  // Synchronise et programme les rappels 1 heure avant tous les événements à venir
  const syncUpcomingEventReminders = useCallback(async () => {
    try {
      const today = new Date().toISOString();
      const { data: upcomingEvents } = await supabase
        .from('events')
        .select('id, title, event_date')
        .gte('event_date', today);

      if (upcomingEvents && upcomingEvents.length > 0) {
        for (const ev of upcomingEvents) {
          if (ev.event_date && ev.title) {
            void scheduleEventReminderNotification({
              eventId: ev.id,
              title: ev.title,
              eventDateStr: ev.event_date,
            });
          }
        }
      }
    } catch (err) {
      console.warn("Erreur lors de la synchronisation des rappels d'événements:", err);
    }
  }, []);

  useEffect(() => {
    if (!memberId) return;

    // Fetch initial data without synchronous setState at start of effect
    void fetchCommunications(false);
    void syncUpcomingEventReminders();

    // Écouteur Realtime : Messages / Communications
    const channelComms = supabase
      .channel('public:communications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'communications' }, (payload) => {
        if (!payload.new.recipient_id || payload.new.recipient_id === memberId) {
          const newItem = payload.new as CommunicationItem;
          setNotifications((prev) => [newItem, ...prev.filter(n => String(n.id) !== String(newItem.id))]);
          sendNativeNotification({
            title: newItem.title || 'Alerte DMK 🔔',
            body: newItem.content || 'Nouveau message du Dahira',
            channelId: 'dmk_alerts',
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'communications' }, (payload) => {
        setNotifications((prev) => prev.map(n => String(n.id) === String(payload.new?.id) ? { ...n, ...payload.new } : n));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'communications' }, (payload) => {
        const deletedId = payload.old?.id;
        if (deletedId !== undefined && deletedId !== null) {
          setNotifications((prev) => prev.filter(n => String(n.id) !== String(deletedId)));
        } else {
          void fetchCommunications(false);
        }
      })
      .subscribe();

    // Écouteur Realtime : Alerte Trésorier Critique (Vibration + Réveil d'écran lors des nouvelles cotisations)
    const channelTreasury = supabase
      .channel('public:treasury_contributions_mobile')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sass_contributions', filter: 'status=eq.En attente' }, (payload) => {
        const contrib = payload.new;
        sendNativeNotification({
          title: '💳 Cotisation à Valider !',
          body: `Nouvelle cotisation de ${(contrib.amount || 0).toLocaleString('fr-FR')} FCFA (${contrib.sass_type || 'Sass'}) reçue.`,
          channelId: 'dmk_treasury',
        });
      })
      .subscribe();

    // Écouteur Realtime : Nouvelles réunions / Dahiras programmés + Rappel 1H
    const channelEvents = supabase
      .channel('public:events_realtime_reminders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
        const newEvent = payload.new;
        if (newEvent && newEvent.title && newEvent.event_date) {
          // Notification immédiate d'annonce de la nouvelle réunion/événement
          sendNativeNotification({
            title: `📅 Nouvel Événement : ${newEvent.title}`,
            body: `Programmé pour le ${new Date(newEvent.event_date).toLocaleDateString('fr-FR')} à ${new Date(newEvent.event_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
            channelId: 'dmk_alerts',
          });

          // Programmation automatique du rappel 1 heure avant
          void scheduleEventReminderNotification({
            eventId: newEvent.id,
            title: newEvent.title,
            eventDateStr: newEvent.event_date,
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, (payload) => {
        const updatedEvent = payload.new;
        if (updatedEvent && updatedEvent.title && updatedEvent.event_date) {
          void scheduleEventReminderNotification({
            eventId: updatedEvent.id,
            title: updatedEvent.title,
            eventDateStr: updatedEvent.event_date,
          });
        }
      })
      .subscribe();

    const handleFocus = () => {
      void fetchCommunications(false);
      void syncUpcomingEventReminders();
    };
    window.addEventListener('focus', handleFocus);

    let appStateListener: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          void fetchCommunications(false);
          void syncUpcomingEventReminders();
        }
      }).then((handle) => {
        appStateListener = handle;
      });
    }

    return () => {
      supabase.removeChannel(channelComms);
      supabase.removeChannel(channelTreasury);
      supabase.removeChannel(channelEvents);
      window.removeEventListener('focus', handleFocus);
      if (appStateListener) appStateListener.remove();
    };
  }, [memberId, fetchCommunications, syncUpcomingEventReminders]);

  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const newReadIds = [...readIds, id];
      setReadIds(newReadIds);
      localStorage.setItem('read_notifications', JSON.stringify(newReadIds));
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id.toString());
    setReadIds(allIds);
    localStorage.setItem('read_notifications', JSON.stringify(allIds));
  };

  const deleteMessage = (id: string) => {
    if (!deletedIds.includes(id)) {
      const newDeletedIds = [...deletedIds, id];
      setDeletedIds(newDeletedIds);
      localStorage.setItem('deleted_notifications', JSON.stringify(newDeletedIds));
    }
  };

  const visibleNotifications = notifications.filter(n => !deletedIds.includes(n.id.toString()));
  const unreadCount = visibleNotifications.filter(n => !readIds.includes(n.id.toString())).length;

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      readIds,
      deletedIds,
      markAsRead,
      markAllAsRead,
      deleteMessage,
      notifications: visibleNotifications,
      loading,
      refreshNotifications: () => fetchCommunications(true)
    }}>
      {children}
    </NotificationContext.Provider>
  );
}
