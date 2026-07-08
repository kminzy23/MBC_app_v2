# 부산MBC 온에어 — 브랜드 리스킨 + PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배포된 웹앱을 MBC 브랜드 라이트 테마로 리스킨하고, 아이폰 홈 화면에 설치되는 PWA(부산MBC 온에어)로 만든다.

**Architecture:** 순수 HTML/JS(빌드 없음) 프론트를 (A) `style.css` 라이트 테마 개편 + 브랜드 에셋(MBC NEW 폰트·마스코트) 임베드, (B) manifest + iOS 메타 + service worker(앱 셸만 캐시) 추가로 확장한다. 앱 로직(auth/db/player)은 건드리지 않는다.

**Tech Stack:** 순수 HTML/CSS/JS, PWA(Web App Manifest + Service Worker), Python+Pillow(아이콘 생성), Caddy 정적 서빙, 로컬 `bin\caddy.exe`.

## Global Constraints

- **앱 이름**: `부산MBC 온에어` (short_name: `MBC 온에어`) — 매니페스트·메타·헤더에 동일 사용.
- **메인 컬러 MBC 퍼플 `#6706D3`**, 보조 블루 `#4664E6`, **온에어=레드 `#FF4141`**, 오프에어=뮤트 그레이.
- **라이트 테마**(배경 밝음, 텍스트 진회색). **단 영상 `.video` 배경은 `#000` 유지.**
- **폰트 `MBC NEW`**(Medium=본문, Bold=제목) 웹폰트 임베드.
- **서비스워커는 앱 셸(정적 자산)만 캐시.** `/live/*`(HLS), `*.supabase.co`, `/js/config.js`는 **절대 캐시/가로채기 금지**(항상 네트워크).
- 앱 클래스명·DOM id·JS 로직은 **변경 금지**(리스킨은 CSS/마크업 추가만).
- 커밋은 각 태스크 끝에서. 배포는 서버 `git pull` + `chmod` + **SW 캐시 버전 bump**.

---

## File Structure

```
frontend/
  fonts/MBCNEW-M.ttf, MBCNEW-B.ttf   # [추가] 공백 없는 이름으로 복사한 MBC NEW 2굵기
  images/mascot.jpg                   # [추가] 마스코트(헤더·로그인)
  icons/icon-180.png,192,512,maskable-512.png  # [추가] PWA 아이콘
  css/style.css                       # [수정] 라이트 테마 + @font-face + 헤더 브랜드
  manifest.json                       # [추가] PWA 매니페스트
  service-worker.js                   # [추가] 앱 셸 캐시(동적 제외)
  js/pwa.js                           # [추가] SW 등록(공유)
  index.html / player.html / admin.html  # [수정] head 메타·제목·마스코트·pwa.js
tools/make_icons.py                   # [추가] 마스코트→아이콘 생성 스크립트
README-phase7.md                      # [추가] 실행/배포 가이드
```

---

### Task 1: 브랜드 에셋을 frontend로 복사

폰트(공백 없는 이름으로)·마스코트를 서빙 대상 폴더에 넣는다.

**Files:**
- Create: `frontend/fonts/MBCNEW-M.ttf`, `frontend/fonts/MBCNEW-B.ttf`
- Create: `frontend/images/mascot.jpg`

**Interfaces:**
- Produces: `../fonts/MBCNEW-M.ttf`·`MBCNEW-B.ttf`(style.css @font-face가 참조), `images/mascot.jpg`(헤더·로그인·아이콘 생성이 참조).

- [ ] **Step 1: 폴더 생성 + 파일 복사(공백 제거 리네임)**

```bash
cd "c:/Users/user/OneDrive/바탕 화면/mbc/test/MBC_app_v2"
mkdir -p frontend/fonts frontend/images frontend/icons
cp "assets/fonts/MBC NEW M.ttf" frontend/fonts/MBCNEW-M.ttf
cp "assets/fonts/MBC NEW B.ttf" frontend/fonts/MBCNEW-B.ttf
cp "assets/images/MBC_icon.jpg" frontend/images/mascot.jpg
```

- [ ] **Step 2: 복사 확인**

```bash
ls -la frontend/fonts/ frontend/images/mascot.jpg
```
Expected: `MBCNEW-M.ttf`, `MBCNEW-B.ttf`(각 ~1.3MB), `mascot.jpg`(~0.5MB) 존재.

- [ ] **Step 3: 커밋**

```bash
git add frontend/fonts/MBCNEW-M.ttf frontend/fonts/MBCNEW-B.ttf frontend/images/mascot.jpg
git commit -m "feat(phase7): add MBC brand fonts + mascot to frontend"
```

---

### Task 2: 라이트 테마 리스킨 (`style.css` 전면 개편)

CSS 변수와 컴포넌트 스타일을 라이트+브랜드로 교체한다. 클래스명·구조 유지, 영상 배경은 검정 유지, 헤더 `.brand` 스타일 추가(마크업은 Task 3).

**Files:**
- Modify: `frontend/css/style.css` (전체 교체)

**Interfaces:**
- Consumes: `frontend/fonts/MBCNEW-*.ttf`(Task 1).
- Produces: `.brand`, `.brand-logo` 클래스(Task 3의 헤더 마크업이 사용). CSS 변수 `--accent`(#6706D3) 등.

- [ ] **Step 1: `frontend/css/style.css`를 아래 내용으로 전체 교체**

```css
/* ===== MBC NEW 웹폰트 ===== */
@font-face {
  font-family: "MBC NEW"; src: url("../fonts/MBCNEW-M.ttf") format("truetype");
  font-weight: 400 500; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "MBC NEW"; src: url("../fonts/MBCNEW-B.ttf") format("truetype");
  font-weight: 600 800; font-style: normal; font-display: swap;
}

/* ===== 라이트 브랜드 테마 ===== */
:root {
  --bg:#f4f2f8; --card:#ffffff; --accent:#6706D3; --accent-2:#4664E6;
  --text:#1f1a2b; --muted:#6f6b7a; --on-air:#FF4141; --border:#e7e3f0;
}
* { box-sizing: border-box; }
body { margin:0; font-family:"MBC NEW", system-ui, -apple-system, "Segoe UI", sans-serif;
       background: var(--bg); color: var(--text); }

/* 헤더 + 브랜드 */
.app-header { padding: 12px 16px; background:#fff; border-bottom:1px solid var(--border);
              display:flex; align-items:center; justify-content:space-between; }
.brand { display:flex; align-items:center; gap:8px; }
.brand-logo { height:30px; width:30px; object-fit:contain; }
.app-header h1 { margin:0; font-size:18px; font-weight:800; color: var(--accent); }
.user-box { display:flex; align-items:center; gap:10px; }
.user-email { color:var(--muted); font-size:13px; }
.logout-btn { padding:6px 12px; border:1px solid var(--border); border-radius:8px;
              background:#fff; color:var(--text); font-size:13px; cursor:pointer; }
.logout-btn:active { background:#f0ecf8; }

.app-main { max-width: 720px; margin: 0 auto; padding: 12px; }
.player-area { position: relative; }
.video { width:100%; aspect-ratio:16/9; background:#000; border-radius:10px; }
.player-status { padding:8px 4px; color: var(--muted); font-size:14px; }

/* 채널 카드 */
.channels-title { font-size:15px; color: var(--muted); margin:16px 4px 8px; font-weight:600; }
.channel-list { list-style:none; margin:0; padding:0; display:grid;
                grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap:10px; }
.channel-card { background: var(--card); border-radius:12px; padding:14px; cursor:pointer;
                display:flex; flex-direction:column; gap:6px; border:1px solid var(--border);
                box-shadow:0 1px 3px rgba(41,21,60,.06); transition: transform .05s ease; }
.channel-card:active { transform: scale(.98); }
.channel-name { font-size:16px; font-weight:700; }
.channel-type { font-size:12px; color: var(--muted); }
.channel-status { font-size:12px; color: var(--muted); }
.channel-status.on-air { color: var(--on-air); font-weight:700; }
.channel-status.off-air { color: var(--muted); }
.channel-thumb { width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:8px; background:#000; }
.admin-link { color:var(--accent); font-size:13px; text-decoration:none; margin-right:4px; font-weight:600; }

/* 라디오(오디오 전용) */
.player-area.mode-radio .video { background: radial-gradient(circle at 50% 40%, #8F83FF, #6706D3); }
.player-area.mode-radio::before {
  content: "🎵 라디오"; position: absolute; z-index: 2; left: 0; right: 0; top: 40px;
  text-align: center; font-size: 22px; color: #fff; pointer-events: none;
}

@media (max-width: 420px) {
  .channel-list { grid-template-columns: repeat(2, 1fr); }
  .app-main { padding: 8px; }
}

/* ===== 인증 화면 ===== */
.auth-wrap { max-width: 360px; margin: 32px auto; padding: 16px; }
.auth-brand { display:flex; flex-direction:column; align-items:center; gap:8px; margin-bottom:16px; }
.auth-brand img { width:96px; height:96px; object-fit:contain; }
.auth-title { text-align:center; font-size:22px; margin:0; font-weight:800; color: var(--accent); }
.auth-form { display:flex; flex-direction:column; gap:10px; background:var(--card);
             padding:20px; border-radius:14px; border:1px solid var(--border);
             box-shadow:0 2px 10px rgba(41,21,60,.06); }
.auth-form h2 { margin:0 0 6px; font-size:16px; }
.auth-form input { padding:12px; border-radius:8px; border:1px solid var(--border);
                   background:#fff; color:var(--text); font-size:15px; }
.auth-form input:focus { outline:2px solid var(--accent); border-color:transparent; }
.auth-form button { padding:12px; border:none; border-radius:8px; background:var(--accent);
                    color:#fff; font-weight:700; font-size:15px; cursor:pointer; }
.auth-form button:active { background:#530aa8; }
.auth-link { color:var(--accent-2); font-size:13px; text-decoration:none; text-align:center; }
.auth-msg { text-align:center; font-size:14px; min-height:20px; }
.auth-msg.err { color:#c0392b; }
.auth-msg.ok { color:#2e7d5b; }
.hidden { display:none; }

/* ===== 관리 화면 ===== */
.admin-form-wrap { margin-bottom:20px; }
.admin-form { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.admin-form input, .admin-form select { padding:8px; border-radius:8px; border:1px solid var(--border);
  background:#fff; color:var(--text); font-size:14px; }
.admin-form .chk { color:var(--muted); font-size:14px; }
.admin-form-btns { display:flex; gap:8px; }
.admin-form button { padding:8px 14px; border:none; border-radius:8px; background:var(--accent);
  color:#fff; font-weight:700; cursor:pointer; }
.admin-table { width:100%; border-collapse:collapse; font-size:14px; }
.admin-table th, .admin-table td { text-align:left; padding:8px; border-bottom:1px solid var(--border); }
.admin-table button { margin-right:6px; padding:4px 10px; border:1px solid var(--border); border-radius:6px;
  background:#fff; color:var(--text); cursor:pointer; font-size:13px; }
```

- [ ] **Step 2: 로컬에서 렌더 확인**

로컬 Caddy 기동 후 브라우저 확인(로컬 실행은 mediamtx 없이 Caddy만으로 정적 확인 가능):
```bash
cd "c:/Users/user/OneDrive/바탕 화면/mbc/test/MBC_app_v2"
./bin/caddy.exe run --config Caddyfile &
```
브라우저 `http://localhost:8080/` → 라이트 테마·MBC 퍼플·MBC NEW 폰트 적용 확인. 확인 후 Caddy 종료:
```bash
# PowerShell: Get-Process caddy | Stop-Process -Force
```
Expected: 배경 밝음, 제목/버튼 퍼플, 폰트가 MBC NEW로 바뀜.

- [ ] **Step 3: 회귀 테스트(로직 무영향 확인)**

```bash
node test/validate.test.js && node test/urls.test.js && node test/channelform.test.js
```
Expected: 3개 모두 `passed`.

- [ ] **Step 4: 커밋**

```bash
git add frontend/css/style.css
git commit -m "feat(phase7): light MBC-brand theme (purple, MBC NEW, on-air red)"
```

---

### Task 3: 헤더·로그인 브랜딩 마크업 + 페이지 제목

세 페이지에 마스코트+앱 이름을 넣고 타이틀을 통일한다. (CSS는 Task 2에 이미 있음.)

**Files:**
- Modify: `frontend/index.html`, `frontend/player.html`, `frontend/admin.html`

**Interfaces:**
- Consumes: `.brand`/`.brand-logo`/`.auth-brand` CSS(Task 2), `images/mascot.jpg`(Task 1).

- [ ] **Step 1: `player.html` 헤더에 브랜드 마크업 + 타이틀 변경**

`<title>방송 스트림 모니터링</title>` → `<title>부산MBC 온에어</title>` 로 변경.
그리고 헤더의 `<h1>방송 스트림</h1>` 를 아래로 교체:
```html
    <div class="brand">
      <img class="brand-logo" src="images/mascot.jpg" alt="" />
      <h1>부산MBC 온에어</h1>
    </div>
```

- [ ] **Step 2: `index.html` 로그인 브랜딩 + 타이틀 변경**

`<title>로그인 — 방송 스트림</title>` → `<title>부산MBC 온에어</title>`.
`<h1 class="auth-title">방송 스트림</h1>` 를 아래로 교체:
```html
    <div class="auth-brand">
      <img src="images/mascot.jpg" alt="" />
      <h1 class="auth-title">부산MBC 온에어</h1>
    </div>
```

- [ ] **Step 3: `admin.html` 헤더 통일**

`admin.html`의 헤더 제목(`<h1>` 텍스트, 예: "채널 관리")을 브랜드 마크업으로 교체:
```html
    <div class="brand">
      <img class="brand-logo" src="images/mascot.jpg" alt="" />
      <h1>부산MBC 온에어 · 관리</h1>
    </div>
```
그리고 `<title>`을 `부산MBC 온에어 · 관리` 로 변경.

- [ ] **Step 4: 렌더 확인**

로컬 Caddy로 `index.html`(마스코트+제목), `player.html`(헤더 브랜드) 확인.
Expected: 로그인 화면 상단에 마스코트, 헤더에 작은 마스코트+"부산MBC 온에어".

- [ ] **Step 5: 커밋**

```bash
git add frontend/index.html frontend/player.html frontend/admin.html
git commit -m "feat(phase7): brand header/login with mascot + 부산MBC 온에어 title"
```

---

### Task 4: PWA 아이콘 생성 (Python+Pillow)

마스코트로 아이콘 4종을 생성한다. 흰 배경 정사각, maskable은 안전영역 여백 확보.

**Files:**
- Create: `tools/make_icons.py`
- Create: `frontend/icons/icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`

**Interfaces:**
- Consumes: `frontend/images/mascot.jpg`(Task 1).
- Produces: `frontend/icons/icon-180.png`·`icon-192.png`·`icon-512.png`·`icon-maskable-512.png`(manifest·apple-touch-icon이 참조).

- [ ] **Step 1: `tools/make_icons.py` 생성**

```python
# 마스코트(흰 배경 JPG)를 정사각 PNG 아이콘으로 변환.
# 표준 아이콘: 여백 8%. maskable: 안전영역 위해 여백 20%.
from PIL import Image
import os

SRC = "frontend/images/mascot.jpg"
OUT = "frontend/icons"
BG = (255, 255, 255)  # 흰 배경(라이트 테마)

os.makedirs(OUT, exist_ok=True)
mascot = Image.open(SRC).convert("RGB")

def make(size, pad_ratio, name):
    canvas = Image.new("RGB", (size, size), BG)
    inner = int(size * (1 - 2 * pad_ratio))
    m = mascot.copy()
    m.thumbnail((inner, inner), Image.LANCZOS)
    x = (size - m.width) // 2
    y = (size - m.height) // 2
    canvas.paste(m, (x, y))
    canvas.save(os.path.join(OUT, name))
    print("wrote", name, size)

make(180, 0.08, "icon-180.png")
make(192, 0.08, "icon-192.png")
make(512, 0.08, "icon-512.png")
make(512, 0.20, "icon-maskable-512.png")
```

- [ ] **Step 2: 스크립트 실행**

```bash
cd "c:/Users/user/OneDrive/바탕 화면/mbc/test/MBC_app_v2"
python tools/make_icons.py
```
Expected: `wrote icon-180.png 180` 등 4줄 출력.

- [ ] **Step 3: 생성물 확인**

```bash
python -c "from PIL import Image; import glob; [print(f, Image.open(f).size) for f in sorted(glob.glob('frontend/icons/*.png'))]"
```
Expected: `icon-180.png (180, 180)`, `icon-192.png (192,192)`, `icon-512.png (512,512)`, `icon-maskable-512.png (512,512)`.

- [ ] **Step 4: 커밋**

```bash
git add tools/make_icons.py frontend/icons/
git commit -m "feat(phase7): generate PWA icons from mascot (Pillow)"
```

---

### Task 5: manifest.json + service worker + 등록 스크립트

PWA 핵심 파일 3종을 만든다. SW는 앱 셸만 캐시하고 동적 요청은 건드리지 않는다.

**Files:**
- Create: `frontend/manifest.json`, `frontend/service-worker.js`, `frontend/js/pwa.js`

**Interfaces:**
- Consumes: `frontend/icons/*`(Task 4).
- Produces: `/manifest.json`, `/service-worker.js`, `js/pwa.js`(Task 6의 head가 링크·로드).

- [ ] **Step 1: `frontend/manifest.json` 생성**

```json
{
  "name": "부산MBC 온에어",
  "short_name": "MBC 온에어",
  "start_url": "/player.html",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#6706D3",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: `frontend/service-worker.js` 생성**

```javascript
// 부산MBC 온에어 — 앱 셸만 캐시하는 서비스워커.
// 동적(영상/인증/설정)은 절대 캐시하지 않는다.
// 배포 때 코드가 바뀌면 CACHE 값을 올려서(예: v2) 옛 캐시를 정리한다.
var CACHE = "mbc-onair-v1";
var SHELL = [
  "/", "/index.html", "/player.html", "/admin.html",
  "/css/style.css",
  "/js/config.js", "/js/supabase.min.js", "/js/auth.js", "/js/db.js",
  "/js/urls.js", "/js/hls.min.js", "/js/player.js", "/js/validate.js",
  "/js/login.js", "/js/channelform.js", "/js/admin.js", "/js/pwa.js",
  "/fonts/MBCNEW-M.ttf", "/fonts/MBCNEW-B.ttf",
  "/images/mascot.jpg",
  "/icons/icon-180.png", "/icons/icon-192.png", "/icons/icon-512.png",
  "/manifest.json"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // config.js 등 일부가 없어도 설치가 실패하지 않게 개별 add + 실패 무시.
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
```

- [ ] **Step 3: `frontend/js/pwa.js` 생성**

```javascript
// 서비스워커 등록(모든 페이지 공용). 실패해도 앱은 정상 동작.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/service-worker.js").catch(function () {});
  });
}
```

- [ ] **Step 4: JSON/JS 문법 확인**

```bash
cd "c:/Users/user/OneDrive/바탕 화면/mbc/test/MBC_app_v2"
python -c "import json; json.load(open('frontend/manifest.json', encoding='utf-8')); print('manifest OK')"
node --check frontend/service-worker.js && node --check frontend/js/pwa.js && echo "JS OK"
```
Expected: `manifest OK` 와 `JS OK`.

- [ ] **Step 5: 커밋**

```bash
git add frontend/manifest.json frontend/service-worker.js frontend/js/pwa.js
git commit -m "feat(phase7): PWA manifest + app-shell service worker + registration"
```

---

### Task 6: 페이지 head에 PWA 메타·아이콘·SW 등록 연결

세 페이지에 매니페스트 링크·테마색·iOS 메타·apple-touch-icon을 넣고 `pwa.js`를 로드한다.

**Files:**
- Modify: `frontend/index.html`, `frontend/player.html`, `frontend/admin.html`

**Interfaces:**
- Consumes: `/manifest.json`·`js/pwa.js`(Task 5), `/icons/icon-180.png`(Task 4).

- [ ] **Step 1: 세 페이지의 `<head>`에 아래 블록 추가**

각 파일에서 `<link rel="stylesheet" href="css/style.css" />` **바로 아래**에 삽입:
```html
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#6706D3" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="부산MBC 온에어" />
  <link rel="apple-touch-icon" href="/icons/icon-180.png" />
```

- [ ] **Step 2: 세 페이지에 `pwa.js` 로드 추가**

각 파일의 `</body>` 직전(마지막 `<script>` 다음 줄)에 추가:
```html
  <script src="js/pwa.js"></script>
```

- [ ] **Step 3: 문법/구조 확인**

```bash
cd "c:/Users/user/OneDrive/바탕 화면/mbc/test/MBC_app_v2"
grep -l "manifest.json" frontend/index.html frontend/player.html frontend/admin.html
grep -c "pwa.js" frontend/index.html frontend/player.html frontend/admin.html
```
Expected: 세 파일 모두 매니페스트 링크 포함, 각 `pwa.js` 1회.

- [ ] **Step 4: 로컬 PWA 확인(크롬 DevTools)**

로컬 Caddy 기동 → `http://localhost:8080/player.html` → DevTools **Application** 탭:
- Manifest: `부산MBC 온에어`, 아이콘 표시, 오류 없음
- Service Workers: `service-worker.js` **activated**
- (선택) Lighthouse → PWA "Installable" 통과
Expected: manifest 유효 + SW 활성.

- [ ] **Step 5: SW 안전성 확인(동적 미캐시)**

DevTools Application → Cache Storage → `mbc-onair-v1` 에 **`/live/*`·supabase·config.js 가 없어야** 함. Network 탭에서 로그인/재생 시 해당 요청이 SW를 우회(네트워크)하는지 확인.
Expected: 캐시에 앱 셸만 존재. (로컬에 스트림 없으면 config.js 미캐시만 확인.)

- [ ] **Step 6: 커밋**

```bash
git add frontend/index.html frontend/player.html frontend/admin.html
git commit -m "feat(phase7): wire PWA head meta + apple-touch-icon + SW registration"
```

---

### Task 7: 배포 + 실기기 검증 + 문서/메모리

서버에 반영하고 아이폰에서 홈 화면 설치를 검증한다. (서버 명령은 사용자가 SSH로 실행.)

**Files:**
- Create: `README-phase7.md`
- Modify: `C:\Users\user\.claude\projects\C--Users-user-OneDrive-------mbc-test-MBC-app-v2\memory\project-status.md`

- [ ] **Step 1: push**

```bash
git push origin main
```

- [ ] **Step 2: 서버 반영(사용자 SSH — README-phase7에 수록)**

```bash
cd /opt/mbc-app && sudo git pull
sudo chmod -R a+rX /opt/mbc-app/frontend
```
> SW 캐시 버전은 코드에 `mbc-onair-v1`로 박혀 있어, 다음 개편 때 `v2`로 올리면 옛 캐시가 정리된다.

- [ ] **Step 3: `README-phase7.md` 작성**

````markdown
# Phase 7 — 부산MBC 온에어 (브랜드 리스킨 + PWA)

## 무엇이 바뀌었나
- 라이트 MBC 브랜드 테마(퍼플 `#6706D3`, MBC NEW 폰트, 마스코트), 온에어=레드.
- PWA: 아이폰/안드로이드 홈 화면에 설치 → 전체화면 앱 실행.

## 배포 반영 (서버 SSH)
```bash
cd /opt/mbc-app && sudo git pull
sudo chmod -R a+rX /opt/mbc-app/frontend
```
코드 개편 시 `frontend/service-worker.js`의 `CACHE` 값을 올린다(v1→v2)로 옛 캐시 정리.

## 아이폰에 앱으로 설치
1. Safari로 `https://mybusanmbc.duckdns.org` 접속
2. 공유 버튼 → **홈 화면에 추가**
3. 홈 화면의 **마스코트 아이콘** 실행 → 주소창 없는 전체화면

## 아이콘 재생성(로고 교체 시)
```bash
python tools/make_icons.py   # frontend/images/mascot.jpg 기반 재생성
```

## 검증 체크리스트
- [ ] 세 화면이 라이트 브랜드 테마로 표시(폰트·퍼플·마스코트)
- [ ] 크롬 DevTools: manifest 유효 + 서비스워커 activated
- [ ] 아이폰 홈 화면 추가 → 아이콘 실행 → 전체화면
- [ ] 서비스워커 활성 상태에서 로그인·채널·재생 정상(동적 미캐시)

## 범위 밖 / 다음
- 스트림 서명 URL 접근제한 = Phase 6. 네이티브(Capacitor) = Mac 확보 후.
````

- [ ] **Step 4: README 커밋 + push**

```bash
git add README-phase7.md
git commit -m "docs(phase7): branded PWA runbook"
git push origin main
```

- [ ] **Step 5: 아이폰 실기기 검증(사용자)**

Safari 접속 → 홈 화면에 추가 → 아이콘 실행 → 전체화면 + 재생 확인.
Expected: 마스코트 아이콘으로 실행되고 전체화면 앱처럼 동작.

- [ ] **Step 6: project-status 메모리 갱신**

`project-status.md`에 "Phase 7(브랜드 PWA) 완료 — 아이폰 홈 설치·전체화면, 라이트 MBC 테마" 반영하고 다음 재개 지점을 "Phase 6(서명 URL) 또는 Phase 8"로 갱신.

---

## Self-Review

**1. Spec coverage** (spec → 태스크):
- 라이트 테마 리스킨(컬러·폰트·마스코트) → Task 1(에셋)+2(CSS)+3(마크업) ✓
- 온에어=레드/영상 검정 유지 → Task 2 ✓
- manifest(부산MBC 온에어) → Task 5 ✓
- 아이콘 180/192/512/maskable → Task 4 ✓
- iOS 메타 + apple-touch-icon → Task 6 ✓
- service worker(앱 셸만, /live·supabase·config.js 제외) → Task 5(로직)+6-Step5(검증) ✓
- SW 등록 → Task 5(pwa.js)+6(로드) ✓
- 배포 + 캐시 버전 관리 + 아이폰 검증 → Task 7 ✓
- 회귀(로직 무영향) → Task 2-Step3 ✓
- 범위 밖(오프라인 영상/푸시/네이티브) → 계획에 미포함(정상) ✓

**2. Placeholder scan:** 모든 파일 내용·명령이 완전 기재됨. "TBD/추후" 없음. (admin.html 헤더 제목은 실제 텍스트가 파일마다 다를 수 있어 "제목 `<h1>`을 교체"로 명시 — 실행 시 해당 h1을 브랜드 블록으로 대체.)

**3. Type/이름 일관성:** CSS 클래스 `.brand`/`.brand-logo`/`.auth-brand`가 Task 2(정의)와 Task 3(사용) 일치. 폰트 파일명 `MBCNEW-M.ttf`/`MBCNEW-B.ttf`가 Task 1(복사)·Task 2(@font-face)·Task 5(SHELL) 일치. 아이콘 파일명 `icon-180/192/512/maskable-512.png`가 Task 4(생성)·5(manifest)·6(apple-touch) 일치. SW 캐시명 `mbc-onair-v1` 일관.
