// public/sw.js - Service Worker for Browser Push Notifications
// This file runs in the browser background.
// Intercepts push events from the server and shows native phone notifications.

'use strict';

self.addEventListener('push', function(event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }

  var title = data.title || 'Rasoi Sakhi';
  var body = data.body || 'You have a new notification!';
  var icon = '/assets/logo.jpg';
  var badge = '/assets/logo.jpg';
  var tag = data.tag || 'rasoi-sakhi-notification';
  var openUrl = data.url || '/#admin-section';

  var options = {
    body: body,
    icon: icon,
    badge: badge,
    tag: tag,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: {
      url: openUrl,
      orderId: data.orderId
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var openUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/#admin-section';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('admin-section') !== -1 && 'focus' in client) {
          client.focus();
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(openUrl);
      }
    })
  );
});