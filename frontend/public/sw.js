// Service Worker for ProxID Push Notifications and Offline Shell
// Pure ASCII only.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  var data = {};
  try {
    data = event.data.json();
  } catch (err) {
    data = { title: 'ProxID Alert', message: event.data.text() };
  }

  var title = data.title || 'ProxID';
  var message = data.body || data.message || 'New update from your ProxID agent';
  var icon = data.icon || '/icon.png';
  var badge = data.badge || '/icon.png';
  var link = data.link || data.url || '/';

  var actions = [];
  if (Array.isArray(data.actions)) {
    actions = data.actions.slice(0, 2).map(function(act) {
      return {
        action: act.action || act.kind || act.id || 'open',
        title: act.title || act.label || 'View'
      };
    });
  }

  var options = {
    body: message,
    icon: icon,
    badge: badge,
    data: {
      link: link,
      actions: actions
    },
    actions: actions,
    tag: data.tag || 'proxid-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  var data = event.notification.data || {};
  var targetUrl = data.link || '/';

  if (event.action) {
    // If user clicked a specific action button with target or link
    if (data.actions && Array.isArray(data.actions)) {
      for (var i = 0; i < data.actions.length; i++) {
        var a = data.actions[i];
        if (a.action === event.action && a.link) {
          targetUrl = a.link;
          break;
        }
      }
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
