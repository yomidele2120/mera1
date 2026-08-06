// Service Worker for Push Notifications
const CACHE_NAME = 'mera-cache-v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let data = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {}
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (urlToOpen !== '/') {
              client.navigate(urlToOpen);
            }
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle incoming call notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INCOMING_CALL') {
    const { callerName, callerId, avatarUrl } = event.data;
    
    self.registration.showNotification('Incoming Call', {
      body: `${callerName} is calling you`,
      icon: avatarUrl || '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'incoming-call',
      requireInteraction: true,
      actions: [
        { action: 'accept', title: 'Accept' },
        { action: 'decline', title: 'Decline' }
      ],
      data: { callerId, type: 'call' }
    });
  }
});
