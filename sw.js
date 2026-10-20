/* Offline-Zwischenspeicher für die installierte App. Nur über http://localhost oder https aktiv, nie bei file://. */
const VERSION = "2026.10.20.2";
const CACHE = `stundenzettel-v3-${VERSION}`;
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
self.addEventListener("install", e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))); });
self.addEventListener("activate", e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
// Programmdateien ausschließlich aus dem Cache: Netzabrufe erfolgen nur nach dem Klick auf „Auf Updates prüfen“.
self.addEventListener("fetch", e=>{
  if(e.request.method!=="GET") return;
  const url = new URL(e.request.url);
  if(url.origin!==location.origin) return;
  e.respondWith(caches.match(e.request, {ignoreSearch:true}).then(r=>r || (e.request.mode==="navigate" ? caches.match("index.html") : Response.error())));
});
self.addEventListener("message", e=>{
  if(e.data && e.data.type==="get-version" && e.ports[0]){
    e.ports[0].postMessage({version:VERSION});
    return;
  }
  if(e.data && e.data.type==="activate-update") self.skipWaiting();
});
