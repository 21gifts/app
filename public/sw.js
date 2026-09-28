/* Push-only service worker for 21.gifts. No cache/offline strategy in v1. */

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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw =
    event.notification.data && typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/welcome';
  const targetUrl = raw === '' ? '/welcome' : raw;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.origin === target.origin && 'focus' in client) {
            if (clientUrl.href !== target.href && 'navigate' in client) {
              return client.navigate(target.href).then((navigated) => {
                if (navigated) {
                  return navigated.focus();
                }
                return client.focus();
              });
            }
            return client.focus();
          }
        } catch {
          // ignore malformed client urls
        }
      }
      let openUrl = '/welcome';
      try {
        const target = new URL(targetUrl, self.location.origin);
        if (target.origin === self.location.origin) {
          openUrl = target.href;
        }
      } catch {
        openUrl = '/welcome';
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(openUrl);
      }
      return undefined;
    }),
  );
});
