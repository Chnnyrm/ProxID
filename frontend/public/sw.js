// Service Worker for ProxID Push Notifications and Offline Shell
// Pure ASCII only.

var CACHE_NAME = 'proxid-appshell-v2';
var APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/brands/concordium.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);

  // Skip API requests from shell cache (API requests handled by TanStack Query or network)
  if (url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(function (networkResponse) {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        var responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(function () {
        return cachedResponse;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_DELIVERED_NOTIFICATIONS') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        notifications: self.__delivered_notifications || []
      });
    }
  }
  if (event.data && event.data.type === 'SIMULATE_PUSH') {
    var simData = event.data.payload || {};
    var simTitle = simData.title || 'ProxID Alert';
    var simMessage = simData.body || simData.message || 'New update from your ProxID agent';
    var simActions = simData.actions || [
      { action: 'apply', title: 'Apply Now' },
      { action: 'reply', title: 'Ask proxidAI' }
    ];
    var simOptions = {
      body: simMessage,
      icon: simData.icon || '/icon.png',
      badge: simData.badge || '/icon.png',
      data: {
        link: simData.link || '/jobs',
        actions: simActions
      },
      actions: simActions,
      tag: simData.tag || 'proxid-sim-push'
    };
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      self.__delivered_notifications = self.__delivered_notifications || [];
      self.__delivered_notifications.push({
        title: simTitle,
        body: simMessage,
        tag: simOptions.tag,
        actions: simActions,
        open_windows_count: clientList.length,
        delivered_with_tab_closed: clientList.length === 0,
        timestamp: new Date().toISOString()
      });
      try {
        self.registration.showNotification(simTitle, simOptions);
      } catch (e) {}
    });
  }
  if (event.data && event.data.type === 'SCHEDULE_CLOSED_TAB_PUSH') {
    var schedDelay = event.data.delay || 1000;
    var schedPayload = event.data.payload || {};
    var schedActions = schedPayload.actions || [
      { action: 'apply', title: 'Apply Now' },
      { action: 'reply', title: 'Ask proxidAI' }
    ];
    setTimeout(function() {
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
        var notif = {
          title: schedPayload.title || 'Work Match Alert',
          body: schedPayload.body || 'New job matched while app was closed',
          tag: 'closed-tab-alert',
          actions: schedActions,
          open_windows_count: clientList.length,
          delivered_with_tab_closed: clientList.length === 0,
          timestamp: new Date().toISOString()
        };
        self.__delivered_notifications = self.__delivered_notifications || [];
        self.__delivered_notifications.push(notif);
        try {
          self.registration.showNotification(notif.title, {
            body: notif.body,
            tag: notif.tag,
            icon: '/icon.png',
            badge: '/icon.png',
            actions: schedActions,
            data: { link: schedPayload.link || '/jobs', actions: schedActions }
          });
        } catch (e) {}
      });
    }, schedDelay);
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

  var actions = [
    { action: 'apply', title: 'Apply Now' },
    { action: 'reply', title: 'Ask proxidAI' }
  ];
  if (Array.isArray(data.actions) && data.actions.length > 0) {
    actions = data.actions.slice(0, 2).map(function(act) {
      return {
        action: act.action || act.kind || act.id || 'open',
        title: act.title || act.label || 'View',
        link: act.link || act.url || ''
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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      self.__delivered_notifications = self.__delivered_notifications || [];
      self.__delivered_notifications.push({
        title: title,
        body: message,
        tag: options.tag,
        open_windows_count: clientList.length,
        delivered_with_tab_closed: clientList.length === 0,
        timestamp: new Date().toISOString()
      });
      try {
        return self.registration.showNotification(title, options);
      } catch (e) {
        return Promise.resolve();
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  var data = event.notification.data || {};
  var targetUrl = data.link || '/';

  if (event.action) {
    if (event.action === 'apply') {
      targetUrl = '/jobs';
    } else if (event.action === 'approve') {
      targetUrl = '/agent';
    } else if (event.action === 'reply') {
      targetUrl = '/agent?listen=1';
    } else if (data.actions && Array.isArray(data.actions)) {
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
