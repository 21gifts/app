import { deletePushSubscription, fetchVapidPublicKey, postPushSubscription } from '@/lib/api';
import { base64UrlToBytes } from '@/lib/webauthn-browser';

/**
 * Web Push tag for one notification row, matching the api mapping.
 *
 * @param row - Notification type and the parent/reply ids the api stamped.
 * @returns The tag to close, or `null` when the type has no banner tag.
 */
export function pushTagForNotification(row: {
  type: string;
  parentId: string;
  replyId: string;
}): string | null {
  switch (row.type) {
    case 'forum_post':
      return `forum_post:${row.parentId}`;
    case 'forum_reply':
      return `forum_reply:${row.replyId}`;
    case 'forum_mention':
      return `forum_mention:${row.replyId}`;
    case 'zap':
      return `zap:${row.replyId}`;
    case 'heart':
      return `heart:${row.replyId}`;
    case 'moderator_appointed':
      return `moderator_appointed:${row.parentId}`;
    default:
      return null;
  }
}

/**
 * Current Web Push subscription endpoint for this browser, when one exists.
 *
 * Looks up `navigator.serviceWorker.getRegistration()` and does not wait on
 * `ready`.
 *
 * @returns The endpoint string, or `undefined` when Push APIs are missing,
 * the lookup rejects, or the endpoint is empty. Never throws.
 */
export async function currentPushEndpoint(): Promise<string | undefined> {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.serviceWorker === 'undefined') {
      return undefined;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration === undefined) {
      return undefined;
    }
    const subscription = await registration.pushManager.getSubscription();
    const endpoint = subscription?.endpoint;
    if (typeof endpoint !== 'string' || endpoint === '') {
      return undefined;
    }
    return endpoint;
  } catch {
    return undefined;
  }
}

/**
 * Close shown Web Push notifications whose `tag` is in `tags`.
 *
 * Looks up `navigator.serviceWorker.getRegistration()` and does not wait on
 * `ready`.
 *
 * @param tags - Notification tags to close.
 * @returns Nothing. No-op for an empty list or when `serviceWorker` /
 * `getNotifications` is missing. Never throws.
 */
export async function closeLocalPushNotifications(tags: readonly string[]): Promise<void> {
  if (tags.length === 0) {
    return;
  }
  try {
    if (typeof navigator === 'undefined' || typeof navigator.serviceWorker === 'undefined') {
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration === undefined) {
      return;
    }
    if (typeof registration.getNotifications !== 'function') {
      return;
    }
    const wanted = new Set(tags);
    const shown = await registration.getNotifications();
    for (const note of shown) {
      if (typeof note.tag === 'string' && wanted.has(note.tag)) {
        note.close();
      }
    }
  } catch {
    return;
  }
}

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

let pushOps: Promise<void> = Promise.resolve();
let pushEpoch = 0;

function runPushOp(op: () => Promise<void>): Promise<void> {
  const run = pushOps.then(op, op);
  pushOps = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Subscribe with the VAPID key and POST the endpoint to the api.
 *
 * @param sessionToken - Bearer session token.
 */
async function subscribeAndPost(sessionToken: string): Promise<void> {
  const registration = await registerPushWorker();
  const publicKey = await fetchVapidPublicKey(sessionToken);
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
    await subscription.unsubscribe().catch(() => undefined);
    throw new Error('Invalid subscription');
  }
  try {
    await postPushSubscription(sessionToken, {
      endpoint,
      keys: { p256dh, auth },
    });
  } catch (err) {
    await subscription.unsubscribe().catch(() => undefined);
    throw err;
  }
}

/**
 * Enable Web Push for the signed-in member: register the worker, subscribe, and
 * POST the subscription to the api.
 *
 * @param sessionToken - Bearer session token.
 * @throws Error with message `Notification permission denied` when permission is
 * not granted, `Push is not configured` when the api reports 503, or
 * `Invalid subscription` when the browser omits endpoint or keys.
 */
export async function enablePush(sessionToken: string): Promise<void> {
  const epoch = pushEpoch;
  await runPushOp(async () => {
    if (epoch !== pushEpoch) {
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }
    if (epoch !== pushEpoch) {
      return;
    }
    await subscribeAndPost(sessionToken);
  });
}

/**
 * Re-POST an existing Web Push subscription when OS permission is already
 * granted. No-op when Push APIs are missing, permission is not `granted`, or
 * there is no local subscription (opt-out). Does not call `requestPermission`
 * or `subscribe()`. POST failure leaves the local subscription in place.
 *
 * @param sessionToken - Bearer session token.
 * @throws When persisting the existing subscription fails (503
 * `Push is not configured`, or the api error on other non-2xx).
 */
export async function resyncPushSubscription(sessionToken: string): Promise<void> {
  const epoch = pushEpoch;
  await runPushOp(async () => {
    if (epoch !== pushEpoch) {
      return;
    }
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }
    if (
      typeof navigator.serviceWorker === 'undefined' ||
      typeof window.PushManager === 'undefined'
    ) {
      return;
    }
    const registration = await registerPushWorker();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription === null) {
      return;
    }
    if (epoch !== pushEpoch) {
      return;
    }
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
      return;
    }
    await postPushSubscription(sessionToken, {
      endpoint,
      keys: { p256dh, auth },
    });
  });
}

/**
 * Disable Web Push for the signed-in member: DELETE the endpoint on the api
 * (when a subscription exists) and unsubscribe locally.
 *
 * @param sessionToken - Bearer session token.
 */
export async function disablePush(sessionToken: string): Promise<void> {
  pushEpoch += 1;
  await runPushOp(async () => {
    const registration = await registerPushWorker();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription === null) {
      return;
    }
    try {
      await deletePushSubscription(sessionToken, subscription.endpoint);
    } finally {
      await subscription.unsubscribe().catch(() => undefined);
    }
  });
}
