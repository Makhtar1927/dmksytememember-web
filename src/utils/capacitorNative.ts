import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * Initialise les plugins natifs Capacitor au démarrage de l'app
 * Ne s'exécute que sur un vrai appareil Android/iOS (pas dans le navigateur web)
 */
export async function initCapacitorNative() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await SplashScreen.hide();
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#2563eb' });

    // Canal principal : Alertes générales DMK (vibration + son + éveil)
    await LocalNotifications.createChannel({
      id: 'dmk_alerts',
      name: 'Alertes DMK',
      description: 'Alertes de cotisations et communications du Dahira',
      importance: 5,   // IMPORTANCE_MAX → bip sonore + vibration + réveil écran
      visibility: 1,  // VISIBILITY_PUBLIC
      vibration: true,
      sound: 'beep.wav',
    });

    // Canal prioritaire : Trésorier — cotisations à valider (vibration + réveil écran)
    await LocalNotifications.createChannel({
      id: 'dmk_treasury',
      name: 'Cotisations à Valider',
      description: 'Alertes critiques pour le trésorier — nouvelles cotisations reçues',
      importance: 5,   // IMPORTANCE_MAX → vibration intense + alerte visuelle + réveil
      visibility: 1,
      vibration: true,
      sound: 'beep.wav',
    });

    // Demande de permission à l'installation
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Capacitor] Init error:', err);
  }
}

/**
 * Envoie une notification locale instantanée avec vibration physique (Haptics) et réveil d'écran
 */
export async function sendNativeNotification({
  title,
  body,
  channelId = 'dmk_alerts',
  id = Math.floor(Math.random() * 1_000_000),
}: {
  title: string;
  body: string;
  channelId?: 'dmk_alerts' | 'dmk_treasury';
  id?: number;
}) {
  // Vibration haptique immédiate si l'appareil est actif
  try {
    if (channelId === 'dmk_treasury') {
      await Haptics.vibrate({ duration: 800 });
    } else {
      await Haptics.notification({ type: NotificationType.Success });
    }
  } catch (e) {
    // Ignorer si haptique indisponible
  }

  if (!Capacitor.isNativePlatform()) {
    // Fallback navigateur web standard
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon.png' });
    }
    return;
  }

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id,
          schedule: { at: new Date(Date.now() + 100) },
          channelId,
          smallIcon: 'ic_stat_icon',
          iconColor: '#2563eb',
        },
      ],
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Capacitor] Notification error:', err);
  }
}

/**
 * Programme une notification locale d'éveil d'écran & vibration 1 heure avant le début d'un événement/réunion
 */
export async function scheduleEventReminderNotification({
  eventId,
  title,
  eventDateStr,
}: {
  eventId: string | number;
  title: string;
  eventDateStr: string;
}) {
  try {
    const eventTime = new Date(eventDateStr).getTime();
    if (isNaN(eventTime)) return;

    // Calculer l'heure de la notification 1 heure avant
    const reminderTime = new Date(eventTime - 60 * 60 * 1000);
    const now = new Date();

    // Si la date du rappel est déjà passée, on ne programme pas
    if (reminderTime <= now) return;

    // Convertir l'eventId en ID numérique unique pour LocalNotifications
    const notificationId = typeof eventId === 'number' 
      ? Math.abs(eventId) % 1_000_000 
      : Math.abs(eventId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 1_000_000;

    if (Capacitor.isNativePlatform()) {
      // Annuler l'ancienne notification programmée s'il y en avait une avec cet ID
      try {
        await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
      } catch (e) {
        // Ignorer si pas trouvée
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title: `⏰ Rappel Réunion dans 1h : ${title}`,
            body: `Votre événement commence dans 1 heure (${new Date(eventDateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}).`,
            id: notificationId,
            schedule: { at: reminderTime },
            channelId: 'dmk_alerts',
            smallIcon: 'ic_stat_icon',
            iconColor: '#2563eb',
          },
        ],
      });
      console.log(`[Capacitor] Notification rappel 1H programmée pour "${title}" à ${reminderTime.toLocaleString('fr-FR')}`);
    } else {
      // Sur le web : programmer un timer pendant la session active si le délai est inférieur à 24 heures
      const delayMs = reminderTime.getTime() - now.getTime();
      if (delayMs > 0 && delayMs < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`⏰ Rappel Réunion dans 1h : ${title}`, {
              body: `Votre événement commence dans 1 heure !`,
              icon: '/icon.png'
            });
          }
        }, delayMs);
      }
    }
  } catch (err) {
    console.warn("Erreur programmation notification rappel 1h:", err);
  }
}

