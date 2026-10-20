/* Offline-Zwischenspeicher für die installierte App. Nur über http://localhost oder https aktiv, nie bei file://. */
const CACHE = "stundenzettel-v3-202610200144";
const FILES = [
 "./",
 "index.html",
 "manifest.webmanifest",
 "app/styles.css",
 "app/time-core.js",
 "app/day-pause.js",
 "app/excel-checkpoints-view.js",
 "app/app.js",
 "extensions/excel-parity/excel-parity.js",
 "pwa/icon-192.png",
 "pwa/icon-512.png",
 "pwa/icon-maskable-512.png"
];
self.addEventListener("install", e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())); });
self.addEventListener("activate", e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
// Programmdateien: zuerst Netz (frische Version, wenn der Server läuft), sonst Zwischenspeicher. Nutzerdaten liegen nie hier.
self.addEventListener("fetch", e=>{
  if(e.request.method!=="GET") return;
  const url = new URL(e.request.url);
  if(url.origin!==location.origin) return;
  e.respondWith(fetch(e.request).then(res=>{
    if(res.ok){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); }
    return res;
  }).catch(()=>caches.match(e.request, {ignoreSearch:true}).then(r=>r || caches.match("index.html"))));
});
