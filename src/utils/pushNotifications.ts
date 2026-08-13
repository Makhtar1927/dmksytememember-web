import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const urlB64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const subscribeToPushNotifications = async (memberId: string) => {
  try {
    // 1. Si on est sur l'application mobile native (Capacitor / Android APK)
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.checkPermissions();
      let status = perm.display;
      if (status !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        status = req.display;
      }

      if (status === 'granted') {
        return { success: true, code: 'SUBSCRIBED', message: 'Notifications mobiles activées avec succès !' };
      } else {
        return { success: false, code: 'PERMISSION_DENIED', message: 'Permission de notification refusée dans les paramètres du téléphone.' };
      }
    }

    // 2. Si on est dans un navigateur Web standard
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn("Les notifications Push ne sont pas supportées par ce navigateur.");
      return { success: false, message: 'Les notifications Web Push ne sont pas supportées par ce navigateur.' };
    }

    // Demander la permission à l'utilisateur
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      console.warn("Permission de notification préalablement refusée par le navigateur.");
      return { success: false, code: 'PERMISSION_DENIED', message: 'Permission de notification refusée par votre navigateur.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn("Permission de notification refusée.");
      return { success: false, code: 'PERMISSION_DENIED', message: 'Permission de notification refusée.' };
    }

    // Récupérer le service worker actif
    const registration = await navigator.serviceWorker.ready;

    // Vérifier si on est déjà abonné
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      // Vérifions juste que c'est bien enregistré dans notre DB
      const { data } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('member_id', memberId)
        .contains('subscription', { endpoint: existingSubscription.endpoint })
        .maybeSingle();
        
      if (data) {
        return { success: true, code: 'ALREADY_SUBSCRIBED', message: 'Notifications déjà activées sur cet appareil.' };
      }
      
      // Sinon, on le sauve
      await supabase.from('push_subscriptions').insert({
        member_id: memberId,
        subscription: existingSubscription.toJSON()
      });
      return { success: true, code: 'SUBSCRIBED', message: 'Notifications resynchronisées avec succès !' };
    }

    // Récupérer la clé publique VAPID depuis l'environnement ou utiliser la clé valide du projet
    const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BBdXKWVJ4xVIoIn5beeZTUYzthUgAsBdJS8F2bh0OfTM3NqiQlG0QdV9hnOdautrdcjoVbtEQ4BEvRTLSQrioc0';

    // S'inscrire au service de Push du navigateur
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(publicVapidKey)
    });

    // Enregistrer l'abonnement dans Supabase
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        member_id: memberId,
        subscription: subscription.toJSON()
      });

    if (error) {
      console.error("Erreur lors de l'enregistrement de l'abonnement Push:", error);
      return { success: false, message: "Erreur lors de l'enregistrement" };
    }

    return { success: true, message: 'Notifications activées avec succès !' };
  } catch (error: any) {
    console.error("Erreur Web Push:", error);
    return { success: false, message: error.message || 'Erreur lors de l’activation des notifications' };
  }
};

/**
 * Vérifie si les notifications sont actuellement activées et autorisées pour le membre
 */
export const checkPushNotificationStatus = async (memberId: string | null): Promise<{ isEnabled: boolean; permission: string }> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.checkPermissions();
      const isEnabled = perm.display === 'granted';
      return { isEnabled, permission: perm.display };
    }

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return { isEnabled: false, permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported' };
    }

    if ('serviceWorker' in navigator && 'PushManager' in window && memberId) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        return { isEnabled: true, permission: 'granted' };
      }
    }

    return { isEnabled: Notification.permission === 'granted', permission: 'granted' };
  } catch (err) {
    console.warn("Erreur vérification statut notification:", err);
    return { isEnabled: false, permission: 'default' };
  }
};

/**
 * Désactive les notifications Push et supprime l'abonnement en base de données
 */
export const unsubscribeFromPushNotifications = async (memberId: string | null) => {
  try {
    if (Capacitor.isNativePlatform()) {
      return { success: true, message: 'Notifications mobiles désactivées avec succès.' };
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
    }

    if (memberId) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('member_id', memberId);
    }

    return { success: true, message: 'Notifications désactivées avec succès.' };
  } catch (error: any) {
    console.error("Erreur lors de la désactivation des notifications:", error);
    return { success: false, message: error.message || 'Erreur lors de la désactivation des notifications' };
  }
};

