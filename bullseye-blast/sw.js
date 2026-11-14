/* offline cache for arcade-bullseye-blast */
const CACHE='arcade-bullseye-blast-ac6e8a9946';
const FILES=["./", "index.html", "manifest.webmanifest", "icon-192.png", "maskable-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png", "favicon-32.png", "b_robot.webp", "b_totem.webp", "b_ufo.webp", "bg_canyon.webp", "bg_carnival.webp", "bg_snow.webp", "bg_space.webp", "bg_yard.webp", "c_cheer.webp", "c_idle.webp", "c_point.webp", "t_balloon.webp", "t_bottle.webp", "t_bull.webp", "t_can.webp", "t_clay.webp", "t_decoy.webp", "t_drone.webp", "t_duck.webp", "t_plate.webp", "t_popup.webp", "t_spring.webp", "t_star.webp", "w_bubble.webp", "w_cork.webp", "w_foam.webp", "w_laser.webp", "w_mega.webp", "w_paint.webp", "w_plasma.webp", "w_water.webp"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('arcade-bullseye-blast-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
const SCOPE=new URL('./',self.location).href;
const OWN=new Set(FILES.map(f=>new URL(f,self.location).href));
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url); u.search=''; u.hash=''; let k=u.href;
  if(k===SCOPE)k=SCOPE+'index.html';
  if(!OWN.has(k)&&!OWN.has(u.href)){  }
  e.respondWith(caches.open(CACHE).then(c=>c.match(k).then(hit=>hit||fetch(r).then(res=>{if(res&&res.ok&&new URL(r.url).origin===location.origin)c.put(k,res.clone());return res;}).catch(()=>hit))));
});
