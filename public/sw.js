/* Push-only service worker for 21.gifts. No asset or offline cache.
   A notification click stores a short-lived 21gifts-push-open path. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/** Device-local Sunday. A broken clock does not pause notifications. */
function isDeviceSunday() {
  try {
    return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date()) === 'Sun';
  } catch {
    return false;
  }
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    payload = parsed !== null && typeof parsed === 'object' ? parsed : {};
  } catch {
    payload = {};
  }

  if (payload.type === 'dismiss') {
    const tags = Array.isArray(payload.tags)
      ? payload.tags.filter((tag) => typeof tag === 'string' && tag !== '')
      : [];
    const tasks = [
      Promise.all(
        tags.map((tag) =>
          self.registration.getNotifications({ tag }).then((notes) => {
            for (const note of notes) {
              note.close();
            }
          }),
        ),
      ),
      self.registration
        .showNotification('21.gifts', {
          silent: true,
          tag: 'dismiss-ack',
          data: { url: '/welcome' },
        })
        .then(() => self.registration.getNotifications({ tag: 'dismiss-ack' }))
        .then((notes) => {
          for (const note of notes) {
            note.close();
          }
        }),
    ];
    const setBadge =
      typeof self.navigator.setAppBadge === 'function'
        ? self.navigator.setAppBadge.bind(self.navigator)
        : typeof self.registration.setAppBadge === 'function'
          ? self.registration.setAppBadge.bind(self.registration)
          : null;
    if (
      setBadge !== null &&
      typeof payload.unreadCount === 'number' &&
      Number.isFinite(payload.unreadCount)
    ) {
      tasks.push(setBadge(Math.max(0, Math.floor(payload.unreadCount))).catch(() => undefined));
    }
    event.waitUntil(Promise.all(tasks));
    return;
  }

  // Public posts and zaps stay quiet on Sunday. A private message still rings.
  // The subscription requires a visible notification, so show one and close it.
  if (isDeviceSunday() && payload.type !== 'conversation') {
    event.waitUntil(
      self.registration
        .showNotification('21.gifts', {
          silent: true,
          tag: 'sunday-quiet',
          data: { url: '/welcome' },
        })
        .then(() => self.registration.getNotifications({ tag: 'sunday-quiet' }))
        .then((notes) => {
          for (const note of notes) {
            note.close();
          }
        }),
    );
    return;
  }

  const title =
    typeof payload.title === 'string' && payload.title !== '' ? payload.title : '21.gifts';
  const body = typeof payload.body === 'string' ? payload.body : '';
  const url = typeof payload.url === 'string' && payload.url !== '' ? payload.url : '/welcome';
  const tag = typeof payload.tag === 'string' && payload.tag !== '' ? payload.tag : undefined;

  const options = {
    body,
    data: { url },
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
  };
  if (tag !== undefined) {
    options.tag = tag;
    options.renotify = true;
  }
  const shown = self.registration.showNotification(title, options);
  const tasks = [shown];
  const setBadge =
    typeof self.navigator.setAppBadge === 'function'
      ? self.navigator.setAppBadge.bind(self.navigator)
      : typeof self.registration.setAppBadge === 'function'
        ? self.registration.setAppBadge.bind(self.registration)
        : null;
  if (setBadge !== null) {
    let n = 1;
    if (typeof payload.unreadCount === 'number' && Number.isFinite(payload.unreadCount)) {
      const floored = Math.floor(payload.unreadCount);
      if (floored > 0) {
        n = floored;
      }
    }
    tasks.push(setBadge(n).catch(() => undefined));
  }
  event.waitUntil(Promise.all(tasks));
});

/** Same-origin href and in-app path from a notification `data.url`. */
function pushOpenTarget(raw) {
  const welcomePath = '/welcome';
  const welcomeHref = new URL(welcomePath, self.location.origin).href;
  if (raw === '' || raw.includes('\\') || raw.startsWith('//')) {
    return { href: welcomeHref, path: welcomePath };
  }
  try {
    const target = new URL(raw, self.location.origin);
    if (target.origin !== self.location.origin) {
      return { href: welcomeHref, path: welcomePath };
    }
    return {
      href: target.href,
      path: `${target.pathname}${target.search}${target.hash}`,
    };
  } catch {
    return { href: welcomeHref, path: welcomePath };
  }
}

/** One id per click so a later click is not erased by an earlier one. */
let pushOpenSeq = 0;

/** Remember the path so a suspended page can open it after the message was missed. */
function rememberPushOpen(path) {
  const id = `${Date.now()}-${pushOpenSeq}`;
  pushOpenSeq += 1;
  return caches
    .open('21gifts-push-open')
    .then((cache) =>
      cache.put(
        new URL(`/push-open/${encodeURIComponent(id)}`, self.location.origin).href,
        new Response(JSON.stringify({ url: path, at: Date.now(), id }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    .catch(() => undefined)
    .then(() => id);
}

/** Focus one same-origin window, preferring the one the person is looking at. */
function chosenPushClient(clientList) {
  let fallback = null;
  for (const client of clientList) {
    try {
      const clientUrl = new URL(client.url);
      if (clientUrl.origin === self.location.origin && 'focus' in client) {
        if (client.focused === true) {
          return client;
        }
        if (fallback === null) {
          fallback = client;
        }
      }
    } catch {
      // ignore malformed client urls
    }
  }
  return fallback;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw =
    event.notification.data && typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/welcome';
  const { href, path } = pushOpenTarget(raw);

  event.waitUntil(
    rememberPushOpen(path).then((id) =>
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        const client = chosenPushClient(clientList);
        if (client !== null) {
          // Safari has no WindowClient.navigate. Focus first so a frozen page
          // can receive the path after it wakes.
          let clientUrl = null;
          try {
            clientUrl = new URL(client.url);
          } catch {
            clientUrl = null;
          }
          const focused = client.focus();
          const deliver = () => {
            const channel = typeof MessageChannel === 'function' ? new MessageChannel() : null;
            if (channel === null) {
              client.postMessage({ type: '21gifts-push-open', url: path, id });
            } else {
              client.postMessage({ type: '21gifts-push-open', url: path, id }, [channel.port2]);
            }
            const ack =
              channel === null
                ? Promise.resolve(false)
                : new Promise((resolve) => {
                    const timer = setTimeout(() => resolve(false), 500);
                    channel.port1.onmessage = () => {
                      clearTimeout(timer);
                      resolve(true);
                    };
                  });
            return ack.then((ok) => {
              // An answered page opened the path with its client-side router.
              // Navigating it again would load a new document and lock the wallet.
              const canNavigate =
                !ok &&
                clientUrl !== null &&
                clientUrl.href !== href &&
                typeof client.navigate === 'function';
              if (canNavigate) {
                return client
                  .navigate(href)
                  .then((navigated) => {
                    if (navigated && 'focus' in navigated) {
                      return navigated.focus();
                    }
                    return undefined;
                  })
                  .catch(() => undefined);
              }
              if (!ok && self.clients.openWindow) {
                return self.clients.openWindow(href);
              }
              return undefined;
            });
          };
          if (focused !== undefined && focused !== null && typeof focused.then === 'function') {
            return focused.then(deliver, deliver);
          }
          return deliver();
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(href);
        }
        return undefined;
      }),
    ),
  );
});
