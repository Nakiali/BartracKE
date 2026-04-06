/* ═══════════════════════════════════════════════════
   BarTracKE Service Worker — PWA / Offline Support
   v1.0
═══════════════════════════════════════════════════ */
var CACHE      = "bartracKE-v1";
var FONT_CACHE = "bartracKE-fonts-v1";

var PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      return cache.addAll(PRECACHE);
    }).then(function(){
      return self.skipWaiting();
    }).catch(function(err){
      console.warn("[BarTracKE SW] install partial failure:", err);
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k!==CACHE && k!==FONT_CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var url = e.request.url;
  if(e.request.method !== "GET") return;
  if(!url.startsWith("http")) return;
  if(url.includes("cdn-cgi") || url.includes("cloudflare-static")) return;

  /* Firebase/Firestore — never cache data calls */
  if(url.includes("firestore.googleapis.com") || url.includes("firebase.googleapis.com")){
    return;
  }
  /* Firebase SDK files — cache them so app works offline */
  if(url.includes("gstatic.com/firebasejs")){
    e.respondWith(
      caches.open(FONT_CACHE).then(function(cache){
        return cache.match(e.request).then(function(cached){
          if(cached) return cached;
          return fetch(e.request).then(function(res){
            if(res && res.status===200) cache.put(e.request, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  /* Google Fonts — cache-first */
  if(url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")){
    e.respondWith(
      caches.open(FONT_CACHE).then(function(cache){
        return cache.match(e.request).then(function(cached){
          if(cached) return cached;
          return fetch(e.request).then(function(res){
            if(res && res.status===200) cache.put(e.request, res.clone());
            return res;
          }).catch(function(){ return new Response("",{status:408}); });
        });
      })
    );
    return;
  }

  /* CDN scripts (jsPDF etc) — cache-first */
  if(url.includes("cdnjs.cloudflare.com")){
    e.respondWith(
      caches.open(CACHE).then(function(cache){
        return cache.match(e.request).then(function(cached){
          if(cached) return cached;
          return fetch(e.request).then(function(res){
            if(res && res.status===200) cache.put(e.request, res.clone());
            return res;
          }).catch(function(){ return new Response("",{status:408}); });
        });
      })
    );
    return;
  }

  /* Same-origin files (app shell) — stale-while-revalidate */
  if(url.startsWith(self.location.origin)){
    e.respondWith(
      caches.match(e.request).then(function(cached){
        var networkFetch = fetch(e.request).then(function(res){
          if(res && res.status===200){
            caches.open(CACHE).then(function(cache){ cache.put(e.request, res.clone()); });
          }
          return res;
        }).catch(function(){});
        return cached || networkFetch || caches.match("/index.html");
      })
    );
    return;
  }

  /* Fallback */
  e.respondWith(
    fetch(e.request).catch(function(){
      return caches.match(e.request);
    })
  );
});

self.addEventListener("message", function(e){
  if(e.data && e.data.type==="SKIP_WAITING") self.skipWaiting();
});
