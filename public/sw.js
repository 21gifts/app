/* Push-only service worker for 21.gifts. No cache/offline strategy in v1. */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    payload = parsed !== null && typeof parsed === 'object' ? parsed : {};
  } catch {
    payload = {};
  }

  const title =
    typeof payload.title === 'string' && payload.title !== '' ? payload.title : '21.gifts';
  const body = typeof payload.body === 'string' ? payload.body : '';
  const url = typeof payload.url === 'string' && payload.url !== '' ? payload.url : '/welcome';
  const tag = typeof payload.tag === 'string' ? payload.tag : undefined;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const anyFocused = clientList.some((client) => client.focused === true);
      if (anyFocused) {
        return undefined;
      }
      const options = {
        body,
        data: { url },
        renotify: true,
        icon: '/apple-touch-icon.png',
      };
      if (tag !== undefined) {
        options.tag = tag;
      }
      return self.registration.showNotification(title, options);
    }),
  );
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
