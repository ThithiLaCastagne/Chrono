const CACHE='prochain-arret-v1.1.0';
const ASSETS=['./','./index.html','./style.css','./app.js','./engine.js','./data.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest','./release.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)))});
// Do not force an update in the middle of an active journey.
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('prochain-arret-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.endsWith('.apk')||url.pathname.endsWith('release.json'))return;
 if(event.request.mode==='navigate'){event.respondWith(caches.open(CACHE).then(c=>c.match('./index.html')).then(cached=>cached||fetch(event.request)));return}
 if(!ASSETS.some(p=>new URL(p,self.registration.scope).pathname===url.pathname))return;
 event.respondWith(caches.open(CACHE).then(c=>c.match(event.request)).then(cached=>cached||fetch(event.request)));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{for(const c of clients){if(c.url.startsWith(self.registration.scope)){c.postMessage({type:'OPEN_TRIP'});return c.focus()}}return self.clients.openWindow(self.registration.scope)}))});
