const VERSION='aeris-shell-v5';
const RUNTIME='aeris-runtime-v2';
const SHELL=['./','./index.html','./manifest.webmanifest','./data/sources/countries.json'];

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
  event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put('./index.html',copy));return response}).catch(async()=>await caches.match('./index.html')||await caches.match('./')));
  return;
 }
 const shellAsset=['script','style','font','image','worker'].includes(request.destination)||url.pathname.includes('/data/');
 if(!shellAsset)return;
 event.respondWith(caches.match(request).then(cached=>{
  const network=fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(RUNTIME).then(cache=>cache.put(request,copy))}return response}).catch(()=>cached);
  return cached||network;
 }));
});
