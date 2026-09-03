/* Finora · service worker
   Guarda la app para que abra sin internet y se pueda instalar. */
const VERSION = "finora-v1";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./iconos/finora-192.png",
  "./iconos/finora-512.png",
  "./iconos/finora-180.png",
  "./iconos/finora-maskable-192.png",
  "./iconos/finora-maskable-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.allSettled(ARCHIVOS.map(u => c.add(new Request(u, { cache: "reload" }))));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data === "actualizar") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Navegación: intenta la red, si no hay, sirve la copia guardada
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const fresca = await fetch(req);
        const c = await caches.open(SHELL);
        c.put("./index.html", fresca.clone());
        return fresca;
      } catch {
        return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  // Tipografías de Google: primero la copia guardada
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    e.respondWith((async () => {
      const guardada = await caches.match(req);
      if (guardada) return guardada;
      try {
        const r = await fetch(req);
        const c = await caches.open(RUNTIME);
        c.put(req, r.clone());
        return r;
      } catch {
        return guardada || Response.error();
      }
    })());
    return;
  }

  // Todo lo demás del mismo origen
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const guardada = await caches.match(req);
      if (guardada) return guardada;
      try {
        const r = await fetch(req);
        if (r.ok) (await caches.open(RUNTIME)).put(req, r.clone());
        return r;
      } catch {
        return Response.error();
      }
    })());
  }
});
