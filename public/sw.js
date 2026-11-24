self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data.json();
  } catch {
    data = {
      title: "WORRIOR 2027",
      body: event.data?.text() || "You have a new notification."
    };
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title || "WORRIOR 2027",
      {
        body: data.body || "New update",
        icon: "/logo.png",
        badge: "/logo.png",
        data: {
          url: data.url || "/"
        }
      }
    )
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const url = new URL(
    event.notification.data?.url || "/",
    self.location.origin
  );

  if (url.origin !== self.location.origin) return;

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(windowClients => {
      const existing = windowClients.find(
        client => new URL(client.url).origin === self.location.origin
      );

      if (existing) {
        existing.navigate(url.href);
        return existing.focus();
      }

      return clients.openWindow(url.href);
    })
  );
});
