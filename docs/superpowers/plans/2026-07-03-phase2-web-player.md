# Phase 2 — 웹 플레이어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저(특히 모바일)에서 채널 목록을 보고 골라 HLS로 재생하는 깔끔한 웹 페이지를 만든다.

**Architecture:** 순수 HTML/JS + hls.js(로컬 파일). 정적 파일을 Python 내장 서버로 서빙한다. player.html이 마크업, channels.js가 데이터, urls.js가 순수 URL 헬퍼, player.js가 재생·상태·에러 로직을 담당한다. iOS 사파리는 네이티브 HLS, 그 외는 hls.js로 분기한다.

**Tech Stack:** HTML5 video, hls.js, 순수 JavaScript(빌드 없음), Python `http.server`, Node(테스트용).

## Global Constraints

- 기술: 순수 HTML/JS + hls.js. 빌드 도구/프레임워크 없음.
- hls.js는 CDN이 아닌 **로컬 파일** `frontend/js/hls.min.js`.
- 로컬 서빙: `python -m http.server 8080 --directory frontend`.
- HLS 스트림 출처: `http://<hostname>:8888/<path>/index.m3u8` (hostname은 `location.hostname`에서).
- 채널 객체 형태: `{ id, name, type('tv'|'radio'), path }`. 예: `{id:'tv1', name:'TV1', type:'tv', path:'live/tv1'}`.
- 로그인/DB화/서명URL/PWA는 범위 밖 (Phase 3/4/6/7).
- 플랫폼: Windows 11, PowerShell. 프로젝트 루트: `c:\Users\user\OneDrive\바탕 화면\mbc\test\MBC_app_v2`.
- git 미초기화 상태 → 커밋 스텝은 선택(git을 쓸 때만). 안 쓰면 Commit 스텝 건너뜀.

---

## File Structure

```
/frontend
  player.html         # 채널 목록 + 플레이어 마크업
  /js
    urls.js           # buildHlsUrl() 순수 함수 (DOM 의존 없음, Node 테스트 가능)
    channels.js       # CHANNELS 배열 (하드코딩 데이터)
    hls.min.js        # hls.js 라이브러리 (다운로드본)
    player.js         # 렌더·재생·상태·에러 로직 (DOM 진입점)
  /css
    style.css         # 반응형 모바일 스타일
/test
  urls.test.js        # urls.js 순수 함수 유닛 테스트 (node)
mediamtx.yml          # (수정) hlsAllowOrigin 명시
```

책임 분리: 데이터(channels.js) / 순수 헬퍼(urls.js) / DOM·재생(player.js) / 마크업(player.html) / 스타일(style.css). urls.js를 분리한 이유는 순수 함수만 Node로 테스트하기 위함(spec의 파일 구조에 테스트 가능성을 위해 추가한 작은 파일).

---

### Task 1: 스캐폴드 + hls.js 다운로드 + CORS 설정 + 서빙 확인

목표: 프론트 폴더 구조와 빈 페이지를 만들고, hls.js를 로컬에 두고, MediaMTX CORS를 명시한 뒤, 페이지가 :8080에서 뜨는 것을 확인한다.

**Files:**
- Create: `frontend/player.html`, `frontend/css/style.css`, `frontend/js/hls.min.js`
- Modify: `mediamtx.yml`

**Interfaces:**
- Produces: `:8080`에서 서빙되는 `player.html`. 전역 `Hls` 사용 가능.

- [ ] **Step 1: 폴더 생성 및 hls.js 다운로드**

Run (프로젝트 루트, PowerShell):
```powershell
New-Item -ItemType Directory -Force frontend\js, frontend\css, test | Out-Null
Invoke-WebRequest "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js" -OutFile frontend\js\hls.min.js
(Get-Item frontend\js\hls.min.js).Length
```
Expected: 파일 크기가 출력됨(수백 KB). 0이 아니면 성공.

- [ ] **Step 2: mediamtx.yml에 CORS 명시**

`mediamtx.yml`에서 HLS 섹션을 찾아 `hlsAllowOrigin` 한 줄을 추가한다.

기존:
```yaml
hls: true
hlsAddress: :8888
# 아무도 안 보고 있어도 계속 변환할지 여부. 테스트 편의상 필요할 때만 변환.
hlsAlwaysRemux: false
# 저지연 불필요 → 표준 HLS (mpegts)
hlsVariant: mpegts
```
변경 후:
```yaml
hls: true
hlsAddress: :8888
# 웹 플레이어(:8080)에서 교차 출처로 재생/probe 하므로 모든 출처 허용
hlsAllowOrigin: '*'
# 아무도 안 보고 있어도 계속 변환할지 여부. 테스트 편의상 필요할 때만 변환.
hlsAlwaysRemux: false
# 저지연 불필요 → 표준 HLS (mpegts)
hlsVariant: mpegts
```

- [ ] **Step 3: player.html 작성**

Create `frontend/player.html`:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>방송 스트림 모니터링</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <header class="app-header"><h1>방송 스트림</h1></header>
  <main class="app-main">
    <section class="player-area">
      <video id="player" class="video" controls playsinline></video>
      <div id="player-status" class="player-status">채널을 선택하세요</div>
    </section>
    <section class="channels">
      <h2 class="channels-title">채널</h2>
      <ul id="channel-list" class="channel-list"></ul>
    </section>
  </main>
  <script src="js/urls.js"></script>
  <script src="js/channels.js"></script>
  <script src="js/hls.min.js"></script>
  <script src="js/player.js"></script>
</body>
</html>
```

- [ ] **Step 4: style.css 최소 스타일 작성**

Create `frontend/css/style.css`:
```css
:root { --bg:#0f1115; --card:#1b1f27; --accent:#3da9fc; --text:#e8eaed; --muted:#9aa0a6; }
* { box-sizing: border-box; }
body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
       background: var(--bg); color: var(--text); }
.app-header { padding: 14px 16px; background:#000; }
.app-header h1 { margin:0; font-size:18px; }
.app-main { max-width: 720px; margin: 0 auto; padding: 12px; }
.video { width:100%; aspect-ratio:16/9; background:#000; border-radius:10px; }
.player-status { padding:8px 4px; color: var(--muted); font-size:14px; }
```

- [ ] **Step 5: 서빙 후 로드 확인**

Run:
```powershell
Start-Process powershell -ArgumentList "-NoExit","-Command","python -m http.server 8080 --directory frontend"
Start-Sleep -Seconds 2
(Invoke-WebRequest http://localhost:8080/player.html -UseBasicParsing).StatusCode
(Invoke-WebRequest http://localhost:8080/js/hls.min.js -UseBasicParsing).StatusCode
```
Expected: 둘 다 `200`.

브라우저에서 `http://localhost:8080/player.html` 열기 → 헤더 "방송 스트림", 빈 비디오 영역, "채널" 제목이 보인다. 개발자도구 콘솔에서 `typeof Hls` 입력 → `"function"`.

- [ ] **Step 6: 커밋** (git 사용 시)
```powershell
git add frontend mediamtx.yml
git commit -m "feat(phase2): scaffold web player, add hls.js, CORS"
```

---

### Task 2: urls.js — HLS URL 조립 순수 함수 (TDD)

목표: 채널과 location으로부터 HLS URL을 만드는 순수 함수를 테스트 우선으로 만든다.

**Files:**
- Create: `frontend/js/urls.js`, `test/urls.test.js`

**Interfaces:**
- Produces: 전역/모듈 `buildHlsUrl(channel, loc)` → `string`.
  - `channel`: `{ path: string, ... }`
  - `loc`: `{ protocol: string, hostname: string }` (브라우저에선 `window.location`)
  - 반환: `` `${loc.protocol}//${loc.hostname}:8888/${channel.path}/index.m3u8` ``

- [ ] **Step 1: 실패하는 테스트 작성**

Create `test/urls.test.js`:
```js
const assert = require('assert');
const { buildHlsUrl } = require('../frontend/js/urls.js');

// localhost
assert.strictEqual(
  buildHlsUrl({ path: 'live/tv1' }, { protocol: 'http:', hostname: 'localhost' }),
  'http://localhost:8888/live/tv1/index.m3u8'
);
// 폰 접속(다른 호스트)에서도 올바른 호스트를 가리켜야 함
assert.strictEqual(
  buildHlsUrl({ path: 'live/radio1' }, { protocol: 'http:', hostname: '192.168.101.191' }),
  'http://192.168.101.191:8888/live/radio1/index.m3u8'
);
console.log('urls.test.js passed');
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```powershell
node test/urls.test.js
```
Expected: FAIL — `Cannot find module '../frontend/js/urls.js'` (아직 파일 없음).

- [ ] **Step 3: 최소 구현**

Create `frontend/js/urls.js`:
```js
// HLS 재생 URL 조립 (순수 함수, DOM 의존 없음).
// loc = { protocol, hostname } — 브라우저에선 window.location 전달.
function buildHlsUrl(channel, loc) {
  return loc.protocol + '//' + loc.hostname + ':8888/' + channel.path + '/index.m3u8';
}

// Node 테스트용 export (브라우저에선 module 미정의라 무시됨)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildHlsUrl };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```powershell
node test/urls.test.js
```
Expected: `urls.test.js passed`.

- [ ] **Step 5: 커밋** (git 사용 시)
```powershell
git add frontend/js/urls.js test/urls.test.js
git commit -m "feat(phase2): add buildHlsUrl pure helper with node test"
```

---

### Task 3: channels.js + 채널 카드 렌더링

목표: 채널 데이터를 정의하고, 페이지에 채널 카드 목록을 그린다(재생은 다음 Task).

**Files:**
- Create: `frontend/js/channels.js`, `frontend/js/player.js`
- Modify: `frontend/css/style.css`

**Interfaces:**
- Consumes: `buildHlsUrl` (Task 2), 전역 `CHANNELS`.
- Produces: 전역 `CHANNELS` 배열; `renderChannels(channels)`가 `#channel-list`에 카드 생성. 각 카드는 `.channel-card[data-id]`, 내부에 `[data-status]` 뱃지 포함.

- [ ] **Step 1: channels.js 작성**

Create `frontend/js/channels.js`:
```js
// 채널 목록 (하드코딩). Phase 4에서 Supabase DB로 대체 예정.
// tv1 = Phase 1에서 검증된 실제 스트림. 나머지는 예시(오프에어로 표시됨).
var CHANNELS = [
  { id: 'tv1',    name: 'TV1',     type: 'tv',    path: 'live/tv1' },
  { id: 'tv2',    name: 'TV2',     type: 'tv',    path: 'live/tv2' },
  { id: 'radio1', name: '라디오1', type: 'radio', path: 'live/radio1' }
];
```

- [ ] **Step 2: player.js — 렌더링만 구현**

Create `frontend/js/player.js`:
```js
(function () {
  var listEl = document.getElementById('channel-list');

  function renderChannels(channels) {
    listEl.innerHTML = '';
    channels.forEach(function (ch) {
      var li = document.createElement('li');
      li.className = 'channel-card channel-' + ch.type;
      li.dataset.id = ch.id;
      li.innerHTML =
        '<span class="channel-name">' + ch.name + '</span>' +
        '<span class="channel-type">' + (ch.type === 'radio' ? '라디오' : 'TV') + '</span>' +
        '<span class="channel-status" data-status>확인 중…</span>';
      listEl.appendChild(li);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderChannels(CHANNELS);
  });

  // 다음 Task에서 재생/probe가 참조할 수 있도록 노출
  window.__player = { renderChannels: renderChannels };
})();
```

- [ ] **Step 3: 카드 스타일 추가**

`frontend/css/style.css` 끝에 추가:
```css
.channels-title { font-size:15px; color: var(--muted); margin:16px 4px 8px; }
.channel-list { list-style:none; margin:0; padding:0; display:grid;
                grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap:10px; }
.channel-card { background: var(--card); border-radius:12px; padding:14px;
                cursor:pointer; display:flex; flex-direction:column; gap:6px;
                border:1px solid #262b34; transition: transform .05s ease; }
.channel-card:active { transform: scale(.98); }
.channel-name { font-size:16px; font-weight:600; }
.channel-type { font-size:12px; color: var(--muted); }
.channel-status { font-size:12px; color: var(--muted); }
.channel-status.on-air { color:#39d98a; font-weight:600; }
.channel-status.off-air { color:#f16a6a; }
```

- [ ] **Step 4: 렌더링 확인**

브라우저에서 `http://localhost:8080/player.html` 새로고침.
Expected: TV1, TV2, 라디오1 카드 3개가 그리드로 표시되고, 각 카드에 "확인 중…" 뱃지가 보인다.

- [ ] **Step 5: 커밋** (git 사용 시)
```powershell
git add frontend/js/channels.js frontend/js/player.js frontend/css/style.css
git commit -m "feat(phase2): channel data and card rendering"
```

---

### Task 4: 채널 클릭 → 재생 (hls.js / iOS 네이티브 분기)

목표: 카드를 클릭하면 해당 채널을 재생한다. iOS는 네이티브 HLS, 그 외는 hls.js.

**Files:**
- Modify: `frontend/js/player.js`

**Interfaces:**
- Consumes: `buildHlsUrl` (Task 2), 전역 `Hls`, `CHANNELS`.
- Produces: `playChannel(channel)` — 비디오에 채널을 로드/재생하고 `#player-status` 갱신.

- [ ] **Step 1: player.js에 재생 로직 추가**

`frontend/js/player.js`를 아래 전체 내용으로 교체:
```js
(function () {
  var video = document.getElementById('player');
  var statusEl = document.getElementById('player-status');
  var listEl = document.getElementById('channel-list');
  var hls = null;

  function setStatus(msg) { statusEl.textContent = msg; }

  function nativeHlsSupported() {
    return video.canPlayType('application/vnd.apple.mpegurl') !== '';
  }

  function stopPlayback() {
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src');
    video.load();
  }

  function playChannel(channel) {
    var url = buildHlsUrl(channel, window.location);
    setStatus(channel.name + ' 로딩 중…');
    stopPlayback();

    if (nativeHlsSupported()) {
      video.src = url;
      video.play().catch(function () {});
      video.addEventListener('loadedmetadata',
        function () { setStatus(channel.name + ' 재생 중'); }, { once: true });
      video.addEventListener('error',
        function () { setStatus(channel.name + ' 재생 불가 (오프에어)'); }, { once: true });
    } else if (window.Hls && Hls.isSupported()) {
      hls = new Hls({ manifestLoadingMaxRetry: 2 });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        video.play().catch(function () {});
        setStatus(channel.name + ' 재생 중');
      });
      hls.on(Hls.Events.ERROR, function (evt, data) {
        if (data.fatal) { setStatus(channel.name + ' 재생 불가 (오프에어)'); stopPlayback(); }
      });
    } else {
      setStatus('이 브라우저는 HLS를 지원하지 않습니다.');
    }
  }

  function renderChannels(channels) {
    listEl.innerHTML = '';
    channels.forEach(function (ch) {
      var li = document.createElement('li');
      li.className = 'channel-card channel-' + ch.type;
      li.dataset.id = ch.id;
      li.innerHTML =
        '<span class="channel-name">' + ch.name + '</span>' +
        '<span class="channel-type">' + (ch.type === 'radio' ? '라디오' : 'TV') + '</span>' +
        '<span class="channel-status" data-status>확인 중…</span>';
      li.addEventListener('click', function () { playChannel(ch); });
      listEl.appendChild(li);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderChannels(CHANNELS);
  });

  window.__player = { renderChannels: renderChannels, playChannel: playChannel };
})();
```

- [ ] **Step 2: 재생 확인 (사전조건: MediaMTX 실행 + OBS로 live/tv1 push 중)**

브라우저에서 새로고침 → **TV1 카드 클릭**.
Expected: 상태가 "TV1 로딩 중…" → "TV1 재생 중"으로 바뀌고 비디오가 재생된다(10~20초 지연). TV2 클릭 시 "재생 불가 (오프에어)".

- [ ] **Step 3: 커밋** (git 사용 시)
```powershell
git add frontend/js/player.js
git commit -m "feat(phase2): play channel on click with hls.js/iOS branch"
```

---

### Task 5: 채널 온에어/오프에어 상태 뱃지

목표: 목록을 그린 뒤 각 채널의 m3u8을 확인해 "온에어/오프에어" 뱃지를 표시한다.

**Files:**
- Modify: `frontend/js/player.js`

**Interfaces:**
- Consumes: `buildHlsUrl`, `CHANNELS`, 렌더된 `.channel-card[data-id]`.
- Produces: `probeChannels(channels)` — 각 카드의 `[data-status]` 뱃지를 갱신.

- [ ] **Step 1: probeChannels 추가 및 호출**

`frontend/js/player.js`의 `renderChannels` 함수 **뒤**에 아래 함수를 추가:
```js
  function probeChannels(channels) {
    channels.forEach(function (ch) {
      var url = buildHlsUrl(ch, window.location);
      var card = listEl.querySelector('.channel-card[data-id="' + ch.id + '"]');
      var badge = card ? card.querySelector('[data-status]') : null;
      if (!badge) { return; }
      fetch(url, { method: 'GET' })
        .then(function (res) {
          badge.textContent = res.ok ? '온에어' : '오프에어';
          badge.className = 'channel-status ' + (res.ok ? 'on-air' : 'off-air');
        })
        .catch(function () {
          badge.textContent = '오프에어';
          badge.className = 'channel-status off-air';
        });
    });
  }
```

그리고 `DOMContentLoaded` 핸들러를 아래로 교체(초기 렌더 후 probe 호출):
```js
  document.addEventListener('DOMContentLoaded', function () {
    renderChannels(CHANNELS);
    probeChannels(CHANNELS);
  });
```

`window.__player` 노출 줄도 probe 포함으로 교체:
```js
  window.__player = { renderChannels: renderChannels, playChannel: playChannel, probeChannels: probeChannels };
```

- [ ] **Step 2: 상태 표시 확인 (MediaMTX 실행 + tv1 push 중)**

브라우저 새로고침.
Expected: TV1 뱃지 "온에어"(초록), TV2·라디오1 뱃지 "오프에어"(빨강). tv1 push를 멈추면 새로고침 시 TV1도 "오프에어".

- [ ] **Step 3: 커밋** (git 사용 시)
```powershell
git add frontend/js/player.js
git commit -m "feat(phase2): on-air/off-air status badges via m3u8 probe"
```

---

### Task 6: 라디오 오디오 전용 UI + 반응형 마무리 + 폰 검증

목표: 라디오 채널은 오디오 전용 UI로 보이게 하고, 모바일 레이아웃을 다듬고, 폰에서 최종 검증한다.

**Files:**
- Modify: `frontend/js/player.js`, `frontend/css/style.css`

**Interfaces:**
- Consumes: `playChannel` (Task 4).
- Produces: `playChannel`이 `type==='radio'`이면 `.player-area`에 `mode-radio` 클래스를 토글.

- [ ] **Step 1: playChannel에 라디오 모드 토글 추가**

`frontend/js/player.js`의 `playChannel` 함수 맨 앞(`var url = ...` 다음 줄)에 추가:
```js
    var playerArea = document.querySelector('.player-area');
    if (channel.type === 'radio') { playerArea.classList.add('mode-radio'); }
    else { playerArea.classList.remove('mode-radio'); }
```

- [ ] **Step 2: 라디오 UI 및 반응형 스타일 추가**

`frontend/css/style.css` 끝에 추가:
```css
/* 라디오(오디오 전용): 비디오 영역을 아트워크 플레이스홀더로 */
.player-area.mode-radio .video {
  aspect-ratio: 16/9;
  background: radial-gradient(circle at 50% 40%, #2a3550, #0f1115);
  position: relative;
}
.player-area.mode-radio::before {
  content: "🎵 라디오"; position: absolute; z-index: 2;
  left: 0; right: 0; top: 40px; text-align: center;
  font-size: 22px; color: var(--text); pointer-events: none;
}
.player-area { position: relative; }

/* 모바일 좁은 화면 */
@media (max-width: 420px) {
  .channel-list { grid-template-columns: repeat(2, 1fr); }
  .app-main { padding: 8px; }
}
```

- [ ] **Step 3: 라디오 UI 확인**

브라우저 새로고침 → 라디오1 카드 클릭.
Expected: 플레이어 영역에 "🎵 라디오" 오버레이가 보인다(오디오 전용 표시). TV 채널 클릭 시 오버레이 사라짐. (라디오1은 실제 스트림이 없으면 "오프에어"이나 UI 분기 자체는 확인됨.)

- [ ] **Step 4: 폰 접속용 방화벽 8080 개방 (관리자 PowerShell, 최초 1회)**

관리자 PowerShell에서:
```powershell
New-NetFirewallRule -DisplayName "WebPlayer 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```
Expected: `Enabled : True`.

- [ ] **Step 5: 폰에서 최종 검증 (같은 WiFi, MediaMTX+OBS tv1 push 중)**

PC IP 확인:
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.AddressState -eq "Preferred" -and ($_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*") } | Select-Object IPAddress
```
폰 브라우저에서 `http://<PC-IP>:8080/player.html` 접속.
Expected: 채널 목록이 뜨고, TV1 "온에어", 클릭 시 재생됨. 화면이 모바일에 맞게 표시된다.

**완료 기준(Phase 2)**: 폰에서 채널을 골라 재생할 수 있고, 온에어 tv1은 재생·없는 채널은 "오프에어" 표시, 레이아웃이 반응형으로 정상.

- [ ] **Step 6: 커밋** (git 사용 시)
```powershell
git add frontend/js/player.js frontend/css/style.css
git commit -m "feat(phase2): radio audio-only UI and responsive layout"
```

---

## 완료 기준 (Phase 2 전체)

- [ ] `http://localhost:8080/player.html`에서 채널 카드 목록 표시
- [ ] TV1 클릭 시 재생, 온에어/오프에어 뱃지 정확
- [ ] 라디오 타입은 오디오 전용 UI로 분기
- [ ] 같은 WiFi 폰에서 채널 선택·재생, 반응형 레이아웃 정상
- [ ] `node test/urls.test.js` 통과

이 기준이 충족되면 Phase 3(Supabase 로그인)로 진행한다.
