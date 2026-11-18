/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging-compat.js');

(function initOnePlaceMessagingSw() {
  try {
    const url = new URL(self.location.href);
    const encodedConfig = url.searchParams.get('config');
    if (!encodedConfig) return;
    const config = JSON.parse(decodeURIComponent(encodedConfig));
    if (!config || !config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId) {
      return;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const notificationTitle =
        (payload.notification && payload.notification.title) ||
        (payload.data && payload.data.title) ||
        'OnePlace Campus Update';
      const notificationBody =
        (payload.notification && payload.notification.body) ||
        (payload.data && payload.data.body) ||
        'Tap to view your campus activity.';
      const actionUrl = (payload.data && payload.data.actionUrl) || '/';

      self.registration.showNotification(notificationTitle, {
        body: notificationBody,
        tag: (payload.data && payload.data.dedupKey) || 'oneplace-update',
        data: { actionUrl },
      });
    });
  } catch (err) {
    console.warn('OnePlace messaging SW skipped initialization:', err);
  }
})();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification && event.notification.data && event.notification.data.actionUrl) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl !== '/') {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
