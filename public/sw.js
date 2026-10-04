// Service worker da LUMIBASE: recebe as notificações push e abre a página
// certa ao tocar nelas. Não guarda páginas em cache (a base é sempre online).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "LUMIBASE";
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icons/icon-192.png?v=3",
        badge: "/icons/badge-96.png",
        lang: "pt-BR",
        data: { url: data.url || "/dashboard" },
      });
      // Avisa as janelas abertas para atualizar o sino.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach((w) => w.postMessage({ type: "lb-push" }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/dashboard", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        try {
          await open.navigate(url);
          return;
        } catch {
          // Janela não controlada por este worker: abre uma nova.
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
