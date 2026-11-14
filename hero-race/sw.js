/* offline cache for arcade-hero-race */
const CACHE='arcade-hero-race-d335aab1ae';
const FILES=["./", "index.html", "manifest.webmanifest", "icon-192.png", "maskable-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png", "favicon-32.png", "bg_cave_far.webp", "bg_cave_mid.webp", "bg_cliff_far.webp", "bg_cliff_mid.webp", "bg_grass_far.webp", "bg_grass_mid.webp", "bg_road_far.webp", "bg_road_mid.webp", "bg_rock_far.webp", "bg_rock_mid.webp", "bg_sky_far.webp", "bg_sky_mid.webp", "bg_water_far.webp", "bg_water_mid.webp", "ui.css", "ui.js", "hero-race-share.jpg", "hero-race-splash.jpg", "aaa-music.js", "music/hero-race-aaa.mp3"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('arcade-hero-race-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
const SCOPE=new URL('./',self.location).href;
const OWN=new Set(FILES.map(f=>new URL(f,self.location).href));
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url); u.search=''; u.hash=''; let k=u.href;
  if(k===SCOPE)k=SCOPE+'index.html';
  if(!OWN.has(k)&&!OWN.has(u.href)){  }
  e.respondWith(caches.open(CACHE).then(c=>c.match(k).then(hit=>hit||fetch(r).then(res=>{if(res&&res.ok&&new URL(r.url).origin===location.origin)c.put(k,res.clone());return res;}).catch(()=>hit))));
});
