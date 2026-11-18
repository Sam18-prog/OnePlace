import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { app, db, handleFirestoreError, OperationType, publicFirebaseConfig } from '../firebase';
import type { PushPermissionState } from '../types/notification';
import { deriveStableTokenId } from '../utils/notificationValidation';

let permissionPromptDismissedThisSession = false;

export function getVapidKey(): string {
  if (typeof import.meta === 'undefined') return '';
  return String(import.meta.env?.VITE_FIREBASE_VAPID_KEY || '').trim();
}

export function hasVapidKeyConfigured(): boolean {
  return getVapidKey().length > 0;
}

export function getBrowserPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  const perm = window.Notification.permission;
  if (perm === 'granted' || perm === 'denied' || perm === 'default') {
    return perm;
  }
  return 'default';
}

async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration> {
  const encodedConfig = encodeURIComponent(JSON.stringify(publicFirebaseConfig));
  const swUrl = `/firebase-messaging-sw.js?config=${encodedConfig}`;
  return navigator.serviceWorker.register(swUrl, { scope: '/' });
}

async function upsertDeviceToken(params: {
  uid: string;
  schoolId: string;
  token: string;
  permissionState: PushPermissionState;
  enabled: boolean;
}): Promise<string> {
  const tokenId = deriveStableTokenId(params.token);
  const ref = doc(db, 'users', params.uid, 'deviceTokens', tokenId);
  const path = `users/${params.uid}/deviceTokens/${tokenId}`;

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        token: params.token,
        enabled: params.enabled,
        permissionState: params.permissionState,
        updatedAt: serverTimestamp(),
        lastRefreshedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        tokenId,
        uid: params.uid,
        schoolId: params.schoolId,
        token: params.token,
        platform: 'web',
        enabled: params.enabled,
        permissionState: params.permissionState,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastRefreshedAt: serverTimestamp(),
      });
    }
    return tokenId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export interface EnablePushResult {
  status: 'enabled' | 'denied' | 'unsupported' | 'missing_vapid' | 'error';
  permissionState: PushPermissionState;
  message: string;
}

export async function enableBrowserPush(params: {
  uid: string;
  schoolId: string;
}): Promise<EnablePushResult> {
  const browserPerm = getBrowserPushPermissionState();
  const vapidKey = getVapidKey();

  // Starter-tier guard: never initialize FCM or request browser permissions without a VAPID key
  if (!vapidKey) {
    return {
      status: 'missing_vapid',
      permissionState: browserPerm,
      message:
        'Browser push is not configured (missing VITE_FIREBASE_VAPID_KEY). In-app notifications remain active.',
    };
  }

  if (browserPerm === 'unsupported') {
    return {
      status: 'unsupported',
      permissionState: 'unsupported',
      message: 'This browser does not support Web Push notifications.',
    };
  }

  if (browserPerm === 'denied') {
    await disableUserDeviceTokens(params.uid, 'denied');
    return {
      status: 'denied',
      permissionState: 'denied',
      message:
        'Browser notification permission is blocked. Re-enable notifications for this site in your browser settings.',
    };
  }

  if (browserPerm === 'default' && permissionPromptDismissedThisSession) {
    return {
      status: 'denied',
      permissionState: 'default',
      message:
        'Browser notification permission was dismissed earlier this session. Use browser site settings to grant permission.',
    };
  }

  const messagingMod = await import('firebase/messaging');
  const messagingSupported = await messagingMod.isSupported().catch(() => false);
  if (!messagingSupported) {
    return {
      status: 'unsupported',
      permissionState: 'unsupported',
      message: 'Firebase Cloud Messaging is not supported in this browser environment.',
    };
  }

  let permission: NotificationPermission = window.Notification.permission;
  if (permission === 'default') {
    permission = await window.Notification.requestPermission();
    if (permission === 'default') {
      permissionPromptDismissedThisSession = true;
    }
  }

  if (permission !== 'granted') {
    await disableUserDeviceTokens(params.uid, permission === 'denied' ? 'denied' : 'default');
    return {
      status: 'denied',
      permissionState: permission === 'denied' ? 'denied' : 'default',
      message:
        permission === 'denied'
          ? 'Notifications were blocked by your browser. You can still use in-app notifications.'
          : 'Browser notification permission was dismissed.',
    };
  }

  try {
    const swRegistration = await registerMessagingServiceWorker();
    const messaging = messagingMod.getMessaging(app);
    const token = await messagingMod.getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      return {
        status: 'error',
        permissionState: 'granted',
        message: 'Could not obtain a browser push registration token. Try again shortly.',
      };
    }

    await upsertDeviceToken({
      uid: params.uid,
      schoolId: params.schoolId,
      token,
      permissionState: 'granted',
      enabled: true,
    });

    return {
      status: 'enabled',
      permissionState: 'granted',
      message: 'Browser push notifications enabled for this device.',
    };
  } catch (err) {
    return {
      status: 'error',
      permissionState: getBrowserPushPermissionState(),
      message:
        err instanceof Error
          ? err.message
          : 'Failed to register this browser for push notifications.',
    };
  }
}

export async function disableUserDeviceTokens(
  uid: string,
  permissionState: PushPermissionState = getBrowserPushPermissionState()
): Promise<void> {
  try {
    const colRef = collection(db, 'users', uid, 'deviceTokens');
    const snap = await getDocs(colRef);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        enabled: false,
        permissionState,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (err) {
    console.warn('Could not update device token status:', err);
  }
}

export async function syncExistingPushToken(params: {
  uid: string;
  schoolId: string;
  pushEnabledInPrefs: boolean;
}): Promise<void> {
  // Never attempt FCM token refresh or permission reads when VAPID is unconfigured
  if (!hasVapidKeyConfigured()) {
    return;
  }

  const browserPerm = getBrowserPushPermissionState();
  if (browserPerm === 'denied') {
    await disableUserDeviceTokens(params.uid, 'denied');
    return;
  }
  if (!params.pushEnabledInPrefs || browserPerm !== 'granted') {
    return;
  }

  try {
    const messagingMod = await import('firebase/messaging');
    const messagingSupported = await messagingMod.isSupported().catch(() => false);
    if (!messagingSupported) return;

    const swRegistration = await registerMessagingServiceWorker();
    const messaging = messagingMod.getMessaging(app);
    const token = await messagingMod.getToken(messaging, {
      vapidKey: getVapidKey(),
      serviceWorkerRegistration: swRegistration,
    });
    if (token) {
      await upsertDeviceToken({
        uid: params.uid,
        schoolId: params.schoolId,
        token,
        permissionState: 'granted',
        enabled: true,
      });
    }
  } catch (err) {
    console.warn('Background push token sync skipped:', err);
  }
}

export async function subscribeForegroundPushMessages(
  onForegroundNotice: (payload: { title: string; body: string }) => void
): Promise<() => void> {
  if (!hasVapidKeyConfigured() || getBrowserPushPermissionState() !== 'granted') {
    return () => {};
  }

  try {
    const messagingMod = await import('firebase/messaging');
    const supported = await messagingMod.isSupported().catch(() => false);
    if (!supported) {
      return () => {};
    }
    const messaging = messagingMod.getMessaging(app);
    return messagingMod.onMessage(messaging, (payload) => {
      const title =
        payload.notification?.title || payload.data?.title || 'OnePlace Campus Update';
      const body = payload.notification?.body || payload.data?.body || '';
      onForegroundNotice({ title, body });
    });
  } catch {
    return () => {};
  }
}
