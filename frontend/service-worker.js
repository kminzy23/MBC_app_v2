// 부산MBC 온에어 — 앱 셸만 캐시하는 서비스워커.
// 동적(영상/인증/설정)은 절대 캐시하지 않는다.
// 배포 때 코드가 바뀌면 CACHE 값을 올려서(예: v2) 옛 캐시를 정리한다.
var CACHE = "mbc-onair-v2";
var SHELL = [
  "/", "/index.html", "/player.html", "/admin.html",
  "/css/style.css",
  "/js/supabase.min.js", "/js/auth.js", "/js/db.js",
  "/js/urls.js", "/js/hls.min.js", "/js/player.js", "/js/validate.js",
  "/js/login.js", "/js/channelform.js", "/js/admin.js", "/js/pwa.js",
  "/fonts/MBCNEW-M.ttf", "/fonts/MBCNEW-B.ttf",
  "/images/mascot.png",
  "/icons/icon-180.png", "/icons/icon-192.png", "/icons/icon-512.png",
  "/manifest.json"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // 일부 자산이 없어도 설치가 실패하지 않게 개별 add + 실패 무시.
    return Promise.all(SHELL.map(function (u) {
      return c.add(u).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  var url = new URL(req.url);
  // 동적/외부는 가로채지 않음(항상 네트워크): HLS, Supabase, config.js, 교차출처
  if (req.method !== "GET") { return; }
  if (url.origin !== self.location.origin) { return; }        // *.supabase.co 등
  if (url.pathname.indexOf("/live/") === 0) { return; }        // HLS 영상
  if (url.pathname === "/js/config.js") { return; }            // 설정/키
  // 앱 셸: 캐시 우선 + 백그라운드 갱신
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
