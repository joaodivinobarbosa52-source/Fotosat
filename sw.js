const V='fotomapa-v6',T='fotomapa-tiles-v2';
const BASE=['./','./index.html','./manifest.json',
'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(c=>Promise.all(BASE.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!==T).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  // Imagens de satélite: usa o que já foi visto e atualiza em segundo plano
  if(u.hostname.includes('arcgisonline.com')){
    e.respondWith(caches.open(T).then(async c=>{
      const hit=await c.match(r);
      const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone());return res}).catch(()=>hit);
      return hit||net;
    }));
    return;
  }
  // App e Leaflet: cache primeiro
  e.respondWith(caches.match(r).then(h=>h||fetch(r).then(res=>{
    if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}
    return res;
  }).catch(()=>caches.match('./index.html'))));
});
