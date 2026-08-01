/* Bar Manager — service worker para Web Push */
self.addEventListener("push", (event) => {
  let data = { title: "Bar Manager", body: "Tienes una actualización", url: "/" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    try {
      data.body = event.data.text();
    } catch (_) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Bar Manager", {
      body: data.body || "",
      icon: "/android-chrome-512x512 (2).ico",
      badge: "/android-chrome-512x512 (2).ico",
      tag: data.tag || "bar-manager",
      renotify: true,
      data: { url: data.url || "/" },
      vibrate: [120, 60, 120],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
