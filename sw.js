// Service worker : met le shell en cache pour un fonctionnement hors-ligne.
// L'app ne fait aucun appel réseau propre (pas de CDN, pas de police distante,
// pas de télémétrie), donc il n'y a que des fichiers statiques à servir.
//
// Incrémente CACHE_NAME à chaque modification d'un fichier listé ci-dessous,
// sinon un appareil déjà installé continuera de servir l'ancienne version.
const CACHE_NAME = "jarvis-v11";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/tokens.css",
  "./css/styles.css",
  "./js/app.js",
  "./js/router.js",
  "./js/state.js",
  "./js/storage.js",
  "./js/schema.js",
  "./js/idb.js",
  "./js/utils.js",
  "./js/seed.js",
  "./js/components/timer.js",
  "./js/components/ring.js",
  "./js/modules/dashboard.js",
  "./js/modules/sport.js",
  "./js/modules/finance.js",
  "./js/modules/habits.js",
  "./js/modules/tasks.js",
  "./js/modules/settings.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Cache-first : le shell ne change qu'au déploiement d'une nouvelle version.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => (request.mode === "navigate" ? caches.match("./index.html") : undefined));
    })
  );
});
