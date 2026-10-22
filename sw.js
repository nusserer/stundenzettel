/* Offline-Zwischenspeicher für die installierte App. Nur über http://localhost oder https aktiv, nie bei file://. */
const VERSION = "2026.10.22.4";
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
async function preCacheRelease(){
  const cache=await caches.open(CACHE);
  await Promise.all(FILES.map(async path=>{
    const request=new Request(path,{cache:"reload"});
    const response=await fetch(request);
    if(!response.ok) throw new Error(`Programmdatei konnte nicht geladen werden: ${path}`);
    await cache.put(request,response);
  }));
}
self.addEventListener("install",()=>{});
self.addEventListener("activate", e=>{ e.waitUntil(preCacheRelease().then(()=>caches.keys()).then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
// Programmdateien ausschließlich aus dem Cache. Erst „Update installieren“ lädt die neue Version ohne HTTP-Cache nach.
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
