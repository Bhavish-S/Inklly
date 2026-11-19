/* Inklly service worker: makes the app installable and shows order alerts.
   It deliberately caches nothing, so customers and staff always see live
   orders and prices. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>' +
      '<body style="font-family:system-ui;padding:40px 20px;text-align:center;color:#172031">' +
      '<h1 style="font-size:20px">You’re offline</h1><p>Check your internet connection, then try again.</p>' +
      '<button onclick="location.reload()" style="margin-top:12px;padding:12px 20px;border:0;border-radius:12px;background:#4F46E5;color:#fff;font-weight:700">Try again</button></body>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    ))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ('focus' in client) return client.focus();
    }
    return self.clients.openWindow(target);
  }));
});
