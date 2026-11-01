const V='fotomapa-v12',T='fotomapa-tiles-v3',MAXT=1500;
const LOCAL=['./','./index.html','./manifest.json'];
const LEAFLET=[
'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(async c=>{
    // Leaflet é obrigatório: se falhar, a instalação tenta de novo depois
    await Promise.all(LEAFLET.map(u=>c.add(new Request(u,{cache:'reload'}))));
    await Promise.all(LOCAL.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!==T).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

let puts=0;
async function limitar(c){
  const ks=await c.keys();
  if(ks.length>MAXT)await Promise.all(ks.slice(0,ks.length-MAXT).map(k=>c.delete(k)));
}
async function avisarClientes(){
  const cs=await self.clients.matchAll({type:'window'});
  cs.forEach(c=>c.postMessage('atualizado'));
}

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);

  // Imagens de satélite: usa o que já foi visto, atualiza em segundo plano, guarda no máximo MAXT
  if(u.hostname.includes('arcgisonline.com')){
    e.respondWith(caches.open(T).then(async c=>{
      const hit=await c.match(r);
      const net=fetch(r).then(res=>{
        if(res&&res.ok){c.put(r,res.clone()).then(()=>{if(++puts%50===0)limitar(c)}).catch(()=>{})}
        return res;
      }).catch(()=>hit);
      return hit||net;
    }));
    return;
  }

  // App (mesmo endereço): abre rápido do cache e confere versão nova em segundo plano
  if(u.origin===self.location.origin){
    e.respondWith((async()=>{
      const hit=await caches.match(r,{ignoreSearch:true});
      const antigo=hit&&hit.clone();
      const net=fetch(u.href,{cache:'no-cache'}).then(async res=>{
        if(res.ok){
          const c=await caches.open(V),chave=u.origin+u.pathname;
          if(antigo){
            const a=await antigo.text(),b=await res.clone().text();
            if(a!==b){await c.put(chave,res.clone());avisarClientes()}
          }else await c.put(chave,res.clone());
        }
        return res;
      });
      e.waitUntil(net.catch(()=>{}));
      if(hit)return hit;
      try{return await net}
      catch(err){
        if(r.mode==='navigate'){const i=await caches.match('./index.html',{ignoreSearch:true});if(i)return i}
        return Response.error();
      }
    })());
    return;
  }

  // Leaflet e outros arquivos de fora: cache primeiro
  e.respondWith(caches.match(r).then(h=>h||fetch(r).then(res=>{
    if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}
    return res;
  })));
});
