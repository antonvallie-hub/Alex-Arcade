/* offline cache for arcade-lib */
const CACHE='arcade-lib-5a1f7c3e88';
const FILES=["./", "index.html", "manifest.webmanifest", "logo.webp", "icon-192.png", "maskable-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png", "favicon-32.png", "aaa-music.js", "music/arcade-hub-aaa.mp3", "spidey-attack/icon-512.png", "juicy-chop/icon-512.png", "hero-race/icon-512.png", "bullseye-blast/icon-512.png", "turbo-toy-racers/icon-512.png", "bolt-buddy/icon-512.png"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('arcade-lib-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
const SCOPE=new URL('./',self.location).href;
const OWN=new Set(FILES.map(f=>new URL(f,self.location).href));
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url); u.search=''; u.hash=''; let k=u.href;
  if(k===SCOPE)k=SCOPE+'index.html';
  if(!OWN.has(k)&&!OWN.has(u.href)){ return; }
  e.respondWith(caches.open(CACHE).then(c=>c.match(k).then(hit=>hit||fetch(r).then(res=>{if(res&&res.ok&&new URL(r.url).origin===location.origin)c.put(k,res.clone());return res;}).catch(()=>hit))));
});
