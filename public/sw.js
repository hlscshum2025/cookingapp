const CACHE_NAME="cookingapp-shell-v1";
const OFFLINE_URL="/offline.html";
const SHELL_ASSETS=[
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL_ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim()),
  );
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;

  if(request.mode==="navigate"){
    event.respondWith(fetch(request).catch(()=>caches.match(OFFLINE_URL)));
    return;
  }

  const cacheable=request.destination==="script"
    ||request.destination==="style"
    ||request.destination==="font"
    ||request.destination==="worker"
    ||url.pathname.startsWith("/icons/")
    ||url.pathname.startsWith("/platforms/")
    ||url.pathname==="/favicon.svg"
    ||url.pathname==="/manifest.webmanifest";
  if(!cacheable)return;

  event.respondWith(caches.open(CACHE_NAME).then(async cache=>{
    const cached=await cache.match(request);
    const network=fetch(request).then(response=>{
      if(response.ok)void cache.put(request,response.clone());
      return response;
    }).catch(()=>cached);
    return cached||network;
  }));
});

