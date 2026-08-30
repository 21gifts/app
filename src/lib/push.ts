import { deletePushSubscription, fetchVapidPublicKey, postPushSubscription } from '@/lib/api';
import { base64UrlToBytes } from '@/lib/webauthn-browser';

/**
 * Decode a VAPID application server public key (url-safe base64) to bytes.
 *
 * @param publicKey - Url-safe base64 VAPID public key from the api.
 * @returns The decoded key bytes for `pushManager.subscribe`.
 */
export function vapidPublicKeyToBytes(publicKey: string): Uint8Array {
  return base64UrlToBytes(publicKey);
}

/**
 * Registers the push-only service worker at `/sw.js` and waits until it is ready.
 *
 * @returns The active {@link ServiceWorkerRegistration}.
 */
export async function registerPushWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => {
    return navigator.serviceWorker.ready;
  });
}

/**
 * Whether the document is displayed as an installed / standalone web app.
 *
 * @returns True when `display-mode: standalone` matches or iOS `navigator.standalone` is set.
 */
export function isStandaloneDisplay(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  return 'standalone' in navigator && Boolean(nav.standalone);
}

/**
 * Whether the current browser is iPhone/iPod Safari (not Chrome/Firefox iOS).
 *
 * @returns True for stock iOS Safari user agents.
 */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  if (!/iPhone|iPod/i.test(ua)) {
    return false;
  }
  if (!/Safari/i.test(ua)) {
    return false;
  }
  if (/CriOS|FxiOS/i.test(ua)) {
    return false;
  }
  return true;
}

/**
 * Enable Web Push for the signed-in member: register the worker, subscribe, and
 * POST the subscription to the api.
 *
 * @param sessionToken - Bearer session token.
 * @throws Error with message `Notification permission denied` when permission is
 * not granted, or `Push is not configured` when the api reports 503.
 */
export async function enablePush(sessionToken: string): Promise<void> {
  const registration = await registerPushWorker();
  const publicKey = await fetchVapidPublicKey(sessionToken);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }
  const applicationServerKey = new Uint8Array(vapidPublicKeyToBytes(publicKey));
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.['p256dh'];
  const auth = json.keys?.['auth'];
  if (
    typeof endpoint !== 'string' ||
    endpoint === '' ||
    typeof p256dh !== 'string' ||
    p256dh === '' ||
    typeof auth !== 'string' ||
    auth === ''
  ) {
    throw new Error('Invalid subscription');
  }
  await postPushSubscription(sessionToken, {
    endpoint,
    keys: { p256dh, auth },
  });
}

/**
 * Disable Web Push for the signed-in member: DELETE the endpoint on the api
 * (when a subscription exists) and unsubscribe locally.
 *
 * @param sessionToken - Bearer session token.
 */
export async function disablePush(sessionToken: string): Promise<void> {
  const registration = await registerPushWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription === null) {
    return;
  }
  await deletePushSubscription(sessionToken, subscription.endpoint);
  await subscription.unsubscribe();
}
