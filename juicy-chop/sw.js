/* offline cache for arcade-juicy-chop */
const CACHE='arcade-juicy-chop-c4e91b7a52';
const FILES=["./", "index.html", "manifest.webmanifest", "icon-192.png", "maskable-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png", "favicon-32.png", "bg_beach.webp", "bg_candy.webp", "bg_jungle.webp", "bg_space.webp", "bg_treehouse.webp", "c_bruno.webp", "c_kiki.webp", "c_luna.webp", "c_momo.webp", "c_pip.webp", "c_rex.webp", "c_tank.webp", "c_thunder.webp", "c_ziggy.webp", "f_apple.webp", "f_banana.webp", "f_blueberry.webp", "f_cherry.webp", "f_coconut.webp", "f_dragonfruit.webp", "f_grapes.webp", "f_kiwi.webp", "f_lemon.webp", "f_mango.webp", "f_orange.webp", "f_peach.webp", "f_pear.webp", "f_pineapple.webp", "f_plum.webp", "f_pomegranate.webp", "f_strawberry.webp", "f_watermelon.webp", "h_apple.webp", "h_banana.webp", "h_blueberry.webp", "h_cherry.webp", "h_coconut.webp", "h_dragonfruit.webp", "h_grapes.webp", "h_kiwi.webp", "h_lemon.webp", "h_mango.webp", "h_orange.webp", "h_peach.webp", "h_pear.webp", "h_pineapple.webp", "h_plum.webp", "h_pomegranate.webp", "h_strawberry.webp", "h_watermelon.webp", "s_broccoli.webp", "s_gold.webp", "s_onion.webp", "s_rainbow.webp", "w_claw.webp", "w_laser.webp", "w_ninja.webp", "w_pizza.webp", "w_rainbow.webp", "w_wand.webp", "w_wood.webp"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('arcade-juicy-chop-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
const SCOPE=new URL('./',self.location).href;
const OWN=new Set(FILES.map(f=>new URL(f,self.location).href));
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url); u.search=''; u.hash=''; let k=u.href;
  if(k===SCOPE)k=SCOPE+'index.html';
  if(!OWN.has(k)&&!OWN.has(u.href)){  }
  e.respondWith(caches.open(CACHE).then(c=>c.match(k).then(hit=>hit||fetch(r).then(res=>{if(res&&res.ok&&new URL(r.url).origin===location.origin)c.put(k,res.clone());return res;}).catch(()=>hit))));
});
