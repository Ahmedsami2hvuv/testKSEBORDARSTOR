/* Minimal service worker: OS tray notifications + open URL on tap */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const origin = self.location.origin;
  const icon = origin + "/pwa-icon-192.png";
  const defaults = {
    title: "إشعار",
    body: "",
    url: origin + "/",
    tag: "kse-push",
  };

  event.waitUntil(
    (async () => {
      let payload = { ...defaults };
      if (event.data) {
        try {
          /* قراءة واحدة فقط: text() ثم JSON — يتوافق مع json() كـ Promise ولا يستهلك الـ stream مرتين */
          const maybeText = event.data.text();
          const text =
            maybeText && typeof maybeText.then === "function" ? await maybeText : maybeText;
          if (text && typeof text === "string" && text.trim()) {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === "object") {
              payload = { ...payload, ...parsed };
            }
          }
        } catch {
          /* ignore */
        }
      }
      const title = typeof payload.title === "string" && payload.title.trim() ? payload.title : defaults.title;
      const body = typeof payload.body === "string" ? payload.body : "";
      const tag = typeof payload.tag === "string" && payload.tag.trim() ? payload.tag : defaults.tag;
      const openUrl =
        typeof payload.url === "string" && payload.url.trim() ? payload.url : defaults.url;
      await self.registration.showNotification(title, {
        body,
        tag,
        icon,
        badge: icon,
        data: { url: openUrl },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const raw = typeof data.url === "string" ? data.url : "/";
  let target;
  try {
    target = raw.startsWith("http") ? raw : new URL(raw, self.location.origin).href;
  } catch {
    target = self.location.origin + "/";
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (!client.url.startsWith(self.location.origin)) continue;
        if ("navigate" in client && typeof client.navigate === "function") {
          return client
            .navigate(target)
            .then(() => client.focus())
            .catch(() => self.clients.openWindow(target));
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    }),
  );
});
