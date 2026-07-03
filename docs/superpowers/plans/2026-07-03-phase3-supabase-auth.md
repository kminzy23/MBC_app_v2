# Phase 3 — Supabase 로그인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이메일/비밀번호 로그인을 얹어, 로그인한 사용자만 player 페이지를 보고 채널을 재생할 수 있게 한다.

**Architecture:** 순수 HTML/JS + Supabase Auth(호스티드). `index.html`이 로그인/회원가입 진입점, `player.html`은 로드 시 세션을 확인해 미로그인 시 리다이렉트한다. supabase-js는 로컬 UMD 파일로 두고 전역 `supabase.createClient`를 쓴다. 접근 차단은 클라이언트(UI) 수준이다(스트림 차단은 Phase 6).

**Tech Stack:** Supabase Auth, supabase-js(UMD 로컬), 순수 JavaScript, Caddy(same-origin 서빙), Node(테스트).

## Global Constraints

- 인증: 이메일/비밀번호. 회원가입 공개. 이메일 확인(Confirm email) ON.
- supabase-js는 CDN이 아닌 로컬 파일 `frontend/js/supabase.min.js`. 전역 `supabase` 사용.
- anon key는 공개용 → `frontend/js/config.js`에 두고 커밋 가능. (RLS로 데이터 보호, 커스텀 테이블은 아직 없음)
- 접근 차단은 클라이언트 리다이렉트만. 스트림 주소 보호는 Phase 6.
- 사용자/권한 테이블은 Phase 4로 보류.
- 서빙: 기존 Caddy same-origin(:8080). 진입점은 `index.html`.
- 플랫폼: Windows 11, PowerShell. 프로젝트 루트: `c:\Users\user\OneDrive\바탕 화면\mbc\test\MBC_app_v2`.
- git 사용 중(main). 각 Task 끝에 커밋.

---

## File Structure

```
frontend/
  index.html          # (신규) 로그인/회원가입/비번재설정 진입점
  player.html         # (수정) auth 가드 + 로그아웃 버튼/이메일 표시
  js/
    config.js         # (신규) SUPABASE_URL, SUPABASE_ANON_KEY
    supabase.min.js   # (신규) supabase-js UMD 로컬
    auth.js           # (신규) Supabase 클라이언트 + 인증 헬퍼(window.Auth)
    validate.js       # (신규) 입력 검증 순수함수 (node 테스트)
    login.js          # (신규) index.html 페이지 로직 (폼/이벤트/복구)
    player.js         # (수정) 로드 시 requireAuth + 로그아웃 배선
  css/style.css       # (수정) 로그인 폼/헤더 스타일
test/
  validate.test.js    # (신규) validate.js 유닛 테스트
```

책임 분리: 설정(config.js) / 검증 순수함수(validate.js) / 인증 헬퍼(auth.js) / index 페이지 로직(login.js) / player 페이지 로직(player.js). auth.js는 DOM 없이 재사용 가능한 헬퍼만 노출한다.

---

### Task 0: Supabase 프로젝트 생성·설정 (수동, 사용자)

목표: Supabase 무료 프로젝트를 만들고 이메일 인증을 켜고, 연동에 필요한 값을 확보한다.

**Files:** (없음 — 외부 대시보드 작업)

**Interfaces:**
- Produces: `SUPABASE_URL`(예: `https://abcd1234.supabase.co`), `SUPABASE_ANON_KEY`(공개 anon key). Task 1에서 config.js에 사용.

- [ ] **Step 1: 프로젝트 생성**

https://supabase.com 가입/로그인 → New project → 이름·비밀번호·리전 설정(무료 티어) → 생성(수 분 소요).

- [ ] **Step 2: 이메일/비밀번호 인증 확인**

Authentication → Providers → **Email** 활성화 확인(기본 ON). "Confirm email"이 **ON**인지 확인.

- [ ] **Step 3: Redirect URL 설정**

Authentication → URL Configuration:
- Site URL: `http://localhost:8080`
- Redirect URLs에 추가: `http://localhost:8080/**`, `http://192.168.*.*:8080/**` (폰/IP 변동 대비)

- [ ] **Step 4: 연동 값 확보**

Project Settings → API에서 다음을 복사해 둔다(Task 1에서 사용):
- **Project URL** (`https://<ref>.supabase.co`)
- **anon public** key

**완료 기준**: Project URL과 anon key를 확보했고, Email provider가 켜져 있다.

---

### Task 1: 라이브러리·설정·클라이언트

목표: supabase-js를 로컬에 두고, 설정과 클라이언트를 만들어 브라우저에서 초기화되는지 확인한다.

**Files:**
- Create: `frontend/js/supabase.min.js`, `frontend/js/config.js`, `frontend/js/auth.js`

**Interfaces:**
- Consumes: Task 0의 URL/anon key.
- Produces: 전역 `window.Auth = { client, signUp, signIn, signOut, getSession, requireAuth, sendPasswordReset }`.
  - `signUp(email, password)` → Promise (supabase auth 응답)
  - `signIn(email, password)` → Promise
  - `signOut()` → Promise
  - `getSession()` → Promise<session|null>
  - `requireAuth()` → Promise<session|null> (세션 없으면 index.html로 이동)
  - `sendPasswordReset(email)` → Promise

- [ ] **Step 1: supabase-js UMD 다운로드**

Run (프로젝트 루트):
```powershell
Invoke-WebRequest "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js" -OutFile frontend\js\supabase.min.js
(Get-Item frontend\js\supabase.min.js).Length
```
Expected: 수백 KB 크기 출력.

- [ ] **Step 2: config.js 작성 (Task 0 값으로)**

Create `frontend/js/config.js` — `<...>` 부분을 Task 0에서 복사한 실제 값으로 채운다:
```js
// Supabase 연동 설정. anon key는 공개용(클라이언트 노출 전제)이라 커밋 가능.
window.SUPABASE_URL = 'https://<프로젝트ref>.supabase.co';
window.SUPABASE_ANON_KEY = '<anon-public-key>';
```

- [ ] **Step 3: auth.js 작성**

Create `frontend/js/auth.js`:
```js
(function () {
  // supabase-js UMD는 전역 `supabase`를 노출한다.
  var sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  function signUp(email, password) {
    return sb.auth.signUp({
      email: email,
      password: password,
      options: { emailRedirectTo: window.location.origin + '/index.html' }
    });
  }
  function signIn(email, password) {
    return sb.auth.signInWithPassword({ email: email, password: password });
  }
  function signOut() {
    return sb.auth.signOut();
  }
  async function getSession() {
    var res = await sb.auth.getSession();
    return res.data.session;
  }
  async function requireAuth() {
    var session = await getSession();
    if (!session) { window.location.replace('index.html'); return null; }
    return session;
  }
  function sendPasswordReset(email) {
    return sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/index.html'
    });
  }

  window.Auth = {
    client: sb,
    signUp: signUp, signIn: signIn, signOut: signOut,
    getSession: getSession, requireAuth: requireAuth, sendPasswordReset: sendPasswordReset
  };
})();
```

- [ ] **Step 4: 파일 서빙 확인**

세 파일이 Caddy(:8080)에서 서빙되는지 확인한다. (클라이언트 실제 초기화 검증은 이 파일들을
로드하는 index.html이 생기는 Task 3 Step 4에서 이뤄진다.)
```powershell
# Caddy가 이미 :8080에서 서빙 중이어야 함
"supabase.min.js: " + (Invoke-WebRequest http://localhost:8080/js/supabase.min.js -UseBasicParsing).StatusCode
"config.js:       " + (Invoke-WebRequest http://localhost:8080/js/config.js -UseBasicParsing).StatusCode
"auth.js:         " + (Invoke-WebRequest http://localhost:8080/js/auth.js -UseBasicParsing).StatusCode
```
Expected: 모두 `200`.

- [ ] **Step 5: 커밋**

```powershell
git add frontend/js/config.js frontend/js/auth.js frontend/js/supabase.min.js
git commit -m "feat(phase3): add supabase client, config, auth helpers"
```

---

### Task 2: validate.js — 입력 검증 순수함수 (TDD)

목표: 이메일·비밀번호 형식 검증 순수함수를 테스트 우선으로 만든다.

**Files:**
- Create: `frontend/js/validate.js`, `test/validate.test.js`

**Interfaces:**
- Produces:
  - `isValidEmail(s)` → boolean
  - `passwordProblem(pw)` → string|null (문제 사유 또는 null)

- [ ] **Step 1: 실패하는 테스트 작성**

Create `test/validate.test.js`:
```js
const assert = require('assert');
const { isValidEmail, passwordProblem } = require('../frontend/js/validate.js');

assert.strictEqual(isValidEmail('a@b.com'), true);
assert.strictEqual(isValidEmail('bad'), false);
assert.strictEqual(isValidEmail('a@b'), false);
assert.strictEqual(isValidEmail(''), false);

assert.strictEqual(passwordProblem('123456'), null);
assert.strictEqual(typeof passwordProblem('123'), 'string'); // 너무 짧음
assert.strictEqual(typeof passwordProblem(''), 'string');
console.log('validate.test.js passed');
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```powershell
node test/validate.test.js
```
Expected: FAIL — `Cannot find module '../frontend/js/validate.js'`.

- [ ] **Step 3: 구현**

Create `frontend/js/validate.js`:
```js
// 입력 검증 순수함수 (DOM/네트워크 없음).
function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 6) {
    return '비밀번호는 6자 이상이어야 합니다.';
  }
  return null;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isValidEmail, passwordProblem };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```powershell
node test/validate.test.js
```
Expected: `validate.test.js passed`.

- [ ] **Step 5: 커밋**

```powershell
git add frontend/js/validate.js test/validate.test.js
git commit -m "feat(phase3): add input validation helpers with node test"
```

---

### Task 3: index.html + login.js — 로그인/회원가입 UI

목표: 로그인·회원가입 화면을 만들고 실제로 가입/로그인이 동작하게 한다.

**Files:**
- Create: `frontend/index.html`, `frontend/js/login.js`
- Modify: `frontend/css/style.css`

**Interfaces:**
- Consumes: `window.Auth`(Task 1), `isValidEmail`/`passwordProblem`(Task 2).
- Produces: 로그인 성공 시 `player.html`로 이동하는 진입 페이지.

- [ ] **Step 1: index.html 작성**

Create `frontend/index.html`:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>로그인 — 방송 스트림</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <main class="auth-wrap">
    <h1 class="auth-title">방송 스트림</h1>

    <form id="login-form" class="auth-form">
      <h2>로그인</h2>
      <input id="login-email" type="email" placeholder="이메일" autocomplete="email" />
      <input id="login-pw" type="password" placeholder="비밀번호" autocomplete="current-password" />
      <button type="submit">로그인</button>
      <a href="#" id="to-signup" class="auth-link">회원가입</a>
      <a href="#" id="to-reset" class="auth-link">비밀번호 재설정</a>
    </form>

    <form id="signup-form" class="auth-form hidden">
      <h2>회원가입</h2>
      <input id="signup-email" type="email" placeholder="이메일" autocomplete="email" />
      <input id="signup-pw" type="password" placeholder="비밀번호 (6자 이상)" autocomplete="new-password" />
      <button type="submit">가입하기</button>
      <a href="#" id="to-login" class="auth-link">로그인으로</a>
    </form>

    <form id="reset-form" class="auth-form hidden">
      <h2>새 비밀번호</h2>
      <input id="reset-pw" type="password" placeholder="새 비밀번호 (6자 이상)" autocomplete="new-password" />
      <button type="submit">비밀번호 변경</button>
    </form>

    <p id="auth-msg" class="auth-msg"></p>
  </main>

  <script src="js/config.js"></script>
  <script src="js/supabase.min.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/validate.js"></script>
  <script src="js/login.js"></script>
</body>
</html>
```

- [ ] **Step 2: login.js 작성**

Create `frontend/js/login.js`:
```js
(function () {
  var loginForm = document.getElementById('login-form');
  var signupForm = document.getElementById('signup-form');
  var resetForm = document.getElementById('reset-form');
  var msg = document.getElementById('auth-msg');

  function show(el) {
    [loginForm, signupForm, resetForm].forEach(function (f) { f.classList.add('hidden'); });
    el.classList.remove('hidden');
    msg.textContent = '';
  }
  function setMsg(text, isError) {
    msg.textContent = text;
    msg.className = 'auth-msg ' + (isError ? 'err' : 'ok');
  }

  // 화면 전환
  document.getElementById('to-signup').addEventListener('click', function (e) { e.preventDefault(); show(signupForm); });
  document.getElementById('to-login').addEventListener('click', function (e) { e.preventDefault(); show(loginForm); });
  document.getElementById('to-reset').addEventListener('click', function (e) {
    e.preventDefault();
    var email = document.getElementById('login-email').value.trim();
    if (!isValidEmail(email)) { setMsg('재설정 메일을 받을 이메일을 로그인 칸에 먼저 입력하세요.', true); return; }
    Auth.sendPasswordReset(email).then(function () {
      setMsg('비밀번호 재설정 메일을 보냈습니다. 메일함을 확인하세요.', false);
    });
  });

  // 로그인
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('login-email').value.trim();
    var pw = document.getElementById('login-pw').value;
    if (!isValidEmail(email)) { setMsg('이메일 형식이 올바르지 않습니다.', true); return; }
    setMsg('로그인 중…', false);
    var res = await Auth.signIn(email, pw);
    if (res.error) { setMsg('로그인 실패: ' + res.error.message, true); return; }
    window.location.replace('player.html');
  });

  // 회원가입
  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    var pw = document.getElementById('signup-pw').value;
    if (!isValidEmail(email)) { setMsg('이메일 형식이 올바르지 않습니다.', true); return; }
    var pwErr = passwordProblem(pw);
    if (pwErr) { setMsg(pwErr, true); return; }
    setMsg('가입 중…', false);
    var res = await Auth.signUp(email, pw);
    if (res.error) { setMsg('가입 실패: ' + res.error.message, true); return; }
    setMsg('가입 완료! 확인 메일의 링크를 눌러 인증한 뒤 로그인하세요.', false);
    show(loginForm);
  });

  // 비밀번호 복구 링크로 들어온 경우: 새 비밀번호 폼 표시
  Auth.client.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') { show(resetForm); }
  });
  resetForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var pw = document.getElementById('reset-pw').value;
    var pwErr = passwordProblem(pw);
    if (pwErr) { setMsg(pwErr, true); return; }
    var res = await Auth.client.auth.updateUser({ password: pw });
    if (res.error) { setMsg('변경 실패: ' + res.error.message, true); return; }
    setMsg('비밀번호가 변경됐습니다. 로그인하세요.', false);
    show(loginForm);
  });
})();
```

- [ ] **Step 3: 로그인 폼 스타일 추가**

`frontend/css/style.css` 끝에 추가:
```css
/* 인증 화면 */
.auth-wrap { max-width: 360px; margin: 40px auto; padding: 16px; }
.auth-title { text-align:center; font-size:20px; margin-bottom:20px; }
.auth-form { display:flex; flex-direction:column; gap:10px; background:var(--card);
             padding:20px; border-radius:12px; border:1px solid #262b34; }
.auth-form h2 { margin:0 0 6px; font-size:16px; }
.auth-form input { padding:12px; border-radius:8px; border:1px solid #3a4150;
                   background:#0f1115; color:var(--text); font-size:15px; }
.auth-form button { padding:12px; border:none; border-radius:8px; background:var(--accent);
                    color:#04121f; font-weight:700; font-size:15px; cursor:pointer; }
.auth-link { color:var(--muted); font-size:13px; text-decoration:none; text-align:center; }
.auth-msg { text-align:center; font-size:14px; min-height:20px; }
.auth-msg.err { color:#f16a6a; }
.auth-msg.ok { color:#39d98a; }
.hidden { display:none; }
```

- [ ] **Step 4: 가입/로그인 동작 확인**

브라우저에서 `http://localhost:8080/index.html` 열기.
- 회원가입 → 이메일/비밀번호 입력 → "가입 완료! 확인 메일…" 메시지.
- 메일함에서 확인 링크 클릭(인증). (테스트 편의상 Supabase에서 Confirm email을 잠시 꺼도 됨)
- 로그인 → 성공 시 `player.html`로 이동(단, player 가드는 Task 4에서 완성).

Expected: 잘못된 이메일/짧은 비번은 인라인 에러, 정상 입력은 가입/로그인 진행.

- [ ] **Step 5: 커밋**

```powershell
git add frontend/index.html frontend/js/login.js frontend/css/style.css
git commit -m "feat(phase3): login/signup/reset UI (index.html + login.js)"
```

---

### Task 4: player.html 가드 + 로그아웃

목표: player 페이지를 로그인 사용자만 보게 하고, 로그아웃 버튼과 로그인 이메일을 표시한다.

**Files:**
- Modify: `frontend/player.html`, `frontend/js/player.js`, `frontend/css/style.css`

**Interfaces:**
- Consumes: `window.Auth`(Task 1).
- Produces: 미로그인 시 index.html로 리다이렉트되는 gated player.

- [ ] **Step 1: player.html 헤더/스크립트 수정**

`frontend/player.html`의 `<header>`를 아래로 교체:
```html
  <header class="app-header">
    <h1>방송 스트림</h1>
    <div class="user-box">
      <span id="user-email" class="user-email"></span>
      <button id="logout-btn" class="logout-btn">로그아웃</button>
    </div>
  </header>
```

그리고 `<body>` 끝의 스크립트 블록을 아래로 교체(auth 관련을 먼저 로드):
```html
  <script src="js/config.js"></script>
  <script src="js/supabase.min.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/urls.js"></script>
  <script src="js/channels.js"></script>
  <script src="js/hls.min.js"></script>
  <script src="js/player.js"></script>
```

- [ ] **Step 2: player.js 진입부 수정 (가드 + 로그아웃)**

`frontend/js/player.js`에서 기존 `DOMContentLoaded` 블록을 아래로 교체:
```js
  document.addEventListener('DOMContentLoaded', async function () {
    var session = await Auth.requireAuth();  // 세션 없으면 index.html로 리다이렉트
    if (!session) { return; }
    var emailEl = document.getElementById('user-email');
    if (emailEl) { emailEl.textContent = session.user.email; }
    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        await Auth.signOut();
        window.location.replace('index.html');
      });
    }
    renderChannels(CHANNELS);
    probeChannels(CHANNELS);
  });
```

- [ ] **Step 3: 헤더 스타일 추가**

`frontend/css/style.css`의 `.app-header` 규칙을 아래로 교체(기존 padding 유지 + flex):
```css
.app-header { padding: 14px 16px; background:#000; display:flex;
              align-items:center; justify-content:space-between; }
.user-box { display:flex; align-items:center; gap:10px; }
.user-email { color:var(--muted); font-size:13px; }
.logout-btn { padding:6px 12px; border:1px solid #3a4150; border-radius:8px;
              background:transparent; color:var(--text); font-size:13px; cursor:pointer; }
```

- [ ] **Step 4: 가드/로그아웃 검증**

1. 로그아웃 상태(브라우저 콘솔에서 `await Auth.signOut()` 또는 새 시크릿창)에서
   `http://localhost:8080/player.html` 접속 → `index.html`로 리다이렉트되는지 확인.
2. 로그인 후 player 접속 → 채널 목록 + 상단에 로그인 이메일 표시.
3. 로그아웃 버튼 클릭 → `index.html`로 이동. 이후 player 재접속 시 다시 리다이렉트.

Expected: 로그인해야만 player가 보인다.

- [ ] **Step 5: 커밋**

```powershell
git add frontend/player.html frontend/js/player.js frontend/css/style.css
git commit -m "feat(phase3): gate player behind auth, add logout"
```

---

### Task 5: 문서화 (README-phase3)

목표: Supabase 설정과 인증 흐름을 재현 가능하게 정리한다.

**Files:**
- Create: `README-phase3.md`

- [ ] **Step 1: README-phase3.md 작성**

Create `README-phase3.md`:
```markdown
# Phase 3 — Supabase 로그인 가이드

## 구성
- 진입점: index.html (로그인/회원가입/비번재설정)
- player.html: 로드 시 세션 확인, 미로그인 시 index.html로 리다이렉트
- Supabase Auth(호스티드) + supabase-js 로컬 UMD

## Supabase 설정 (최초 1회)
1. supabase.com → New project (무료)
2. Authentication → Providers → Email 활성화, Confirm email ON
3. Authentication → URL Configuration:
   - Site URL: http://localhost:8080
   - Redirect URLs: http://localhost:8080/**, http://192.168.*.*:8080/**
4. Project Settings → API에서 Project URL, anon key 복사 → frontend/js/config.js에 기입

## 실행
    .\bin\mediamtx.exe .\mediamtx.yml
    .\bin\caddy.exe run --config Caddyfile --adapter caddyfile
접속: http://localhost:8080/ (index.html)

## 흐름
- 회원가입 → 확인 메일 링크 클릭 → 로그인 → player.html
- 로그아웃 → index.html
- 비밀번호 재설정: 로그인 화면에서 이메일 입력 후 "비밀번호 재설정" → 메일 링크 → 새 비밀번호

## 범위/한계
- 접근 차단은 클라이언트(UI) 수준. 스트림 주소(:8080/live/...)는 아직 직접 접근 가능 → Phase 6(서명 URL)에서 차단.
- 사용자 권한 등급/시청 가능 채널은 Phase 4.

## 다음 단계
Phase 4 — 채널 DB화(Supabase) + 썸네일/온에어 + UX 다듬기.
```

- [ ] **Step 2: 커밋**

```powershell
git add README-phase3.md
git commit -m "docs(phase3): add auth setup/flow guide"
```

---

## 완료 기준 (Phase 3 전체)

- [ ] `node test/validate.test.js` 통과
- [ ] index.html에서 회원가입 → 확인 메일 → 로그인 동작
- [ ] 미로그인 상태로 player.html 접근 시 index.html로 리다이렉트
- [ ] 로그인 후 player에서 채널 재생 + 상단 이메일 표시
- [ ] 로그아웃 시 index.html로 이동하고 재접근 차단
- [ ] 비밀번호 재설정 메일 흐름 동작

이 기준이 충족되면 Phase 4(채널 DB화·UX)로 진행한다.
