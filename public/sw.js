const VERSION='aeris-shell-v12';
const RUNTIME='aeris-runtime-v8';
const SHELL=['./','./index.html','./manifest.webmanifest','./icons/apple-touch-icon.png','./icons/aeris-192.png','./icons/aeris-512.png','./data/sources/countries.json'];

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(url)))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('aeris-shell-')||key.startsWith('aeris-runtime-'))&&!([VERSION,RUNTIME].includes(key))).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(Promise.race([fetch(request),new Promise((_,reject)=>setTimeout(()=>reject(new Error('offline navigation timeout')),3500))]).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put('./index.html',copy));return response}).catch(async()=>await caches.match('./index.html')||await caches.match('./')));
  return;
 }
 // Zone snapshots and their manifests must prefer the current deployment.
 // A saved copy remains available when the network cannot supply the file.
 if(url.pathname.includes('/data/')){
  event.respondWith(fetch(request).then(async response=>{
   if(!response.ok)return await caches.match(request)||response;
   const copy=response.clone();
   event.waitUntil(caches.open(RUNTIME).then(cache=>cache.put(request,copy)));
   return response;
  }).catch(()=>caches.match(request).then(cached=>cached||new Response('Zone dataset unavailable offline',{status:503}))));
  return;
 }
 const shellAsset=['script','style','font','image','worker'].includes(request.destination)||url.pathname.includes('/data/');
 if(!shellAsset)return;
 event.respondWith(caches.match(request).then(cached=>{
  const network=fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(RUNTIME).then(cache=>cache.put(request,copy))}return response}).catch(()=>cached);
  return cached||network;
 }));
});
