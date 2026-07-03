# Phase 4 — 채널 관리 + UI 다듬기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 채널을 Supabase DB에서 불러오고, 관리자만 앱 안 관리 화면에서 채널을 CRUD 할 수 있게 한다.

**Architecture:** Supabase `channels`/`profiles` 테이블 + RLS로 권한을 서버에서 강제한다. `db.js`가 Supabase 쿼리 헬퍼(`window.DB`)를 제공하고, player는 하드코딩 대신 DB에서 채널을 불러온다. `admin.html`은 is_admin 사용자만 접근해 채널을 추가/수정/삭제한다.

**Tech Stack:** Supabase(Postgres+RLS), supabase-js, 순수 JavaScript, Caddy(same-origin), Node(테스트).

## Global Constraints

- 채널 저장: Supabase `channels` 테이블. 관리자 구분: `profiles.is_admin` + RLS 강제.
- 채널 객체 형태: `{ id, name, type('tv'|'radio'), path, thumbnail_url, sort_order, enabled }`.
- 관리자 쓰기(INSERT/UPDATE/DELETE)는 RLS로 `is_admin()`만 허용. 읽기는 로그인 사용자 누구나.
- 썸네일은 `thumbnail_url` 필드(비면 기본 카드). 파일 업로드는 범위 밖.
- 기존 same-origin(Caddy :8080) 유지. supabase-js는 로컬 UMD, `window.Auth.client` 재사용.
- 플랫폼: Windows 11, PowerShell. git 사용(main). 각 Task 끝에 커밋.

---

## File Structure

```
frontend/
  admin.html        (신규) 관리자 채널 CRUD 화면
  player.html       (수정) db.js 로드, channels.js 제거, 관리자 '관리' 링크
  js/
    db.js           (신규) Supabase 쿼리 헬퍼 window.DB
    admin.js        (신규) 관리자 페이지 로직(가드 + CRUD)
    channelform.js  (신규) 채널 폼 검증 순수함수
    player.js       (수정) DB.listChannels() 사용, 썸네일 렌더, 관리 링크
  js/channels.js    (삭제)
  css/style.css     (수정) 썸네일/관리 폼/테이블 스타일
test/
  channelform.test.js (신규)
```

책임: SQL 스키마(Task 0) / 쿼리 헬퍼(db.js) / 폼 검증 순수함수(channelform.js) / 뷰어(player.js) / 관리자(admin.js).

---

### Task 0: Supabase 스키마·RLS·시드 (수동, 사용자)

목표: channels/profiles 테이블, is_admin 헬퍼, 트리거, RLS 정책, 초기 채널을 만들고 본인 계정을 관리자로 지정한다.

**Files:** (없음 — Supabase SQL Editor)

**Interfaces:**
- Produces: `channels`(시드 3행), `profiles`(본인 is_admin=true), `public.is_admin()`.

- [ ] **Step 1: SQL 실행**

Supabase 대시보드 → **SQL Editor** → New query → 아래 전체를 붙여넣고 **Run**:
```sql
-- 테이블
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('tv','radio')),
  path text not null,
  thumbnail_url text,
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- is_admin() 헬퍼
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists(select 1 from public.profiles where user_id = auth.uid() and is_admin);
$$;

-- 회원가입 시 profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.channels enable row level security;
alter table public.profiles enable row level security;

drop policy if exists channels_select_authenticated on public.channels;
create policy channels_select_authenticated on public.channels
  for select to authenticated using (true);
drop policy if exists channels_insert_admin on public.channels;
create policy channels_insert_admin on public.channels
  for insert to authenticated with check (public.is_admin());
drop policy if exists channels_update_admin on public.channels;
create policy channels_update_admin on public.channels
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists channels_delete_admin on public.channels;
create policy channels_delete_admin on public.channels
  for delete to authenticated using (public.is_admin());

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = auth.uid());

-- 기존 사용자 profiles 백필(트리거는 신규 가입에만 작동)
insert into public.profiles (user_id) select id from auth.users
  on conflict (user_id) do nothing;

-- 초기 채널 시드
insert into public.channels (name, type, path, sort_order) values
  ('TV1', 'tv', 'live/tv1', 1),
  ('TV2', 'tv', 'live/tv2', 2),
  ('라디오1', 'radio', 'live/radio1', 3);
```
Expected: "Success. No rows returned".

- [ ] **Step 2: 본인 계정을 관리자로 지정**

같은 SQL Editor에서(이메일을 본인 것으로 교체):
```sql
update public.profiles set is_admin = true
  where user_id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');
```
Expected: `UPDATE 1`.

- [ ] **Step 3: 확인**

```sql
select name, type, path, sort_order, enabled from public.channels order by sort_order;
select p.is_admin, u.email from public.profiles p join auth.users u on u.id = p.user_id;
```
Expected: 채널 3행, 본인 이메일의 is_admin = true.

**완료 기준**: channels 3행, 본인 계정 is_admin=true, RLS 활성.

---

### Task 1: db.js — Supabase 쿼리 헬퍼

목표: 채널 CRUD와 isAdmin을 담당하는 헬퍼를 만든다.

**Files:**
- Create: `frontend/js/db.js`

**Interfaces:**
- Consumes: `window.Auth.client`(Phase 3).
- Produces: `window.DB = { listChannels, createChannel, updateChannel, deleteChannel, isAdmin }`.
  - `listChannels(opts?)` → Promise<채널[]> (기본 enabled=true, sort_order 오름차순; `{all:true}`면 전체)
  - `createChannel(fields)` → Promise<채널>
  - `updateChannel(id, fields)` → Promise<채널>
  - `deleteChannel(id)` → Promise<true>
  - `isAdmin()` → Promise<boolean>

- [ ] **Step 1: db.js 작성**

Create `frontend/js/db.js`:
```js
(function () {
  var sb = window.Auth.client; // Phase 3에서 만든 supabase 클라이언트 재사용

  async function listChannels(opts) {
    opts = opts || {};
    var q = sb.from('channels').select('*').order('sort_order', { ascending: true });
    if (!opts.all) { q = q.eq('enabled', true); }
    var res = await q;
    if (res.error) { throw res.error; }
    return res.data;
  }
  async function createChannel(fields) {
    var res = await sb.from('channels').insert(fields).select().single();
    if (res.error) { throw res.error; }
    return res.data;
  }
  async function updateChannel(id, fields) {
    var res = await sb.from('channels').update(fields).eq('id', id).select().single();
    if (res.error) { throw res.error; }
    return res.data;
  }
  async function deleteChannel(id) {
    var res = await sb.from('channels').delete().eq('id', id);
    if (res.error) { throw res.error; }
    return true;
  }
  async function isAdmin() {
    var res = await sb.from('profiles').select('is_admin').maybeSingle();
    if (res.error || !res.data) { return false; }
    return !!res.data.is_admin;
  }

  window.DB = {
    listChannels: listChannels, createChannel: createChannel,
    updateChannel: updateChannel, deleteChannel: deleteChannel, isAdmin: isAdmin
  };
})();
```

- [ ] **Step 2: 서빙 확인**

```powershell
"db.js: " + (Invoke-WebRequest http://localhost:8080/js/db.js -UseBasicParsing).StatusCode
```
Expected: `200`. (기능 검증은 player가 이 파일을 로드하는 Task 3에서 이뤄진다.)

- [ ] **Step 3: 커밋**

```powershell
git add frontend/js/db.js
git commit -m "feat(phase4): add supabase channel/profile query helpers (window.DB)"
```

---

### Task 2: channelform.js — 폼 검증 (TDD)

목표: 채널 폼 입력 검증 순수함수를 테스트 우선으로 만든다.

**Files:**
- Create: `frontend/js/channelform.js`, `test/channelform.test.js`

**Interfaces:**
- Produces: `channelFormProblem(fields)` → string|null.

- [ ] **Step 1: 실패 테스트 작성**

Create `test/channelform.test.js`:
```js
const assert = require('assert');
const { channelFormProblem } = require('../frontend/js/channelform.js');

assert.strictEqual(channelFormProblem({ name: 'TV1', type: 'tv', path: 'live/tv1' }), null);
assert.strictEqual(typeof channelFormProblem({ name: '', type: 'tv', path: 'live/tv1' }), 'string');   // 이름 없음
assert.strictEqual(typeof channelFormProblem({ name: 'X', type: 'tv', path: '' }), 'string');          // 경로 없음
assert.strictEqual(typeof channelFormProblem({ name: 'X', type: 'movie', path: 'p' }), 'string');      // 잘못된 타입
assert.strictEqual(channelFormProblem({ name: '라디오', type: 'radio', path: 'live/r1' }), null);
console.log('channelform.test.js passed');
```

- [ ] **Step 2: 실패 확인**

Run: `node test/channelform.test.js`
Expected: FAIL — `Cannot find module '../frontend/js/channelform.js'`.

- [ ] **Step 3: 구현**

Create `frontend/js/channelform.js`:
```js
// 채널 폼 입력 검증 순수함수 (DOM/네트워크 없음).
function channelFormProblem(fields) {
  if (!fields || typeof fields.name !== 'string' || !fields.name.trim()) {
    return '채널 이름을 입력하세요.';
  }
  if (typeof fields.path !== 'string' || !fields.path.trim()) {
    return '스트림 경로(path)를 입력하세요.';
  }
  if (fields.type !== 'tv' && fields.type !== 'radio') {
    return "타입은 'tv' 또는 'radio' 여야 합니다.";
  }
  return null;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { channelFormProblem };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node test/channelform.test.js`
Expected: `channelform.test.js passed`.

- [ ] **Step 5: 커밋**

```powershell
git add frontend/js/channelform.js test/channelform.test.js
git commit -m "feat(phase4): add channel form validation with node test"
```

---

### Task 3: player 뷰어를 DB 채널로 전환 + 썸네일 + 관리 링크

목표: player가 하드코딩 대신 DB에서 채널을 불러오고, 썸네일을 렌더하며, 관리자에게 '관리' 링크를 보인다.

**Files:**
- Modify: `frontend/player.html`, `frontend/js/player.js`, `frontend/css/style.css`
- Delete: `frontend/js/channels.js`

**Interfaces:**
- Consumes: `window.DB`(Task 1), `window.Auth`(Phase 3).

- [ ] **Step 1: player.html 스크립트/헤더 수정**

`frontend/player.html`의 헤더 `.user-box`를 아래로 교체(관리 링크 추가):
```html
    <div class="user-box">
      <a id="admin-link" class="admin-link hidden" href="admin.html">관리</a>
      <span id="user-email" class="user-email"></span>
      <button id="logout-btn" class="logout-btn">로그아웃</button>
    </div>
```

스크립트 블록에서 `channels.js`를 `db.js`로 교체:
```html
  <script src="js/config.js"></script>
  <script src="js/supabase.min.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/db.js"></script>
  <script src="js/urls.js"></script>
  <script src="js/hls.min.js"></script>
  <script src="js/player.js"></script>
```

- [ ] **Step 2: channels.js 삭제**

Run:
```powershell
Remove-Item frontend\js\channels.js
```

- [ ] **Step 3: player.js — renderChannels에 썸네일 추가**

`frontend/js/player.js`의 `renderChannels` 안 `li.innerHTML = ...` 부분을 아래로 교체:
```js
      var thumb = ch.thumbnail_url
        ? '<img class="channel-thumb" src="' + ch.thumbnail_url + '" alt="" />'
        : '';
      li.innerHTML =
        thumb +
        '<span class="channel-name">' + ch.name + '</span>' +
        '<span class="channel-type">' + (ch.type === 'radio' ? '라디오' : 'TV') + '</span>' +
        '<span class="channel-status" data-status>확인 중…</span>';
```

- [ ] **Step 4: player.js — DOMContentLoaded를 DB 로드로 교체**

`frontend/js/player.js`의 `DOMContentLoaded` 블록 전체를 아래로 교체:
```js
  document.addEventListener('DOMContentLoaded', async function () {
    var session = await Auth.requireAuth();
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
    // 관리자면 관리 링크 노출
    try {
      if (await DB.isAdmin()) {
        var adminLink = document.getElementById('admin-link');
        if (adminLink) { adminLink.classList.remove('hidden'); }
      }
    } catch (e) { /* 무시: 관리 링크 없이 진행 */ }
    // 채널을 DB에서 로드
    try {
      var channels = await DB.listChannels();
      renderChannels(channels);
      probeChannels(channels);
    } catch (e) {
      setStatus('채널을 불러오지 못했습니다: ' + e.message);
    }
  });
```

- [ ] **Step 5: 썸네일/관리 링크 스타일 추가**

`frontend/css/style.css` 끝에 추가:
```css
.channel-thumb { width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:8px; background:#000; }
.admin-link { color:var(--accent); font-size:13px; text-decoration:none; margin-right:4px; }
```

- [ ] **Step 6: 뷰어 검증 (로그인 필요)**

브라우저에서 로그인 후 `http://localhost:8080/player.html`.
Expected: DB 시드 채널(TV1/TV2/라디오1)이 표시된다. 관리자 계정이면 헤더에 "관리" 링크가 보인다. TV1은 온에어(OBS push 중일 때) + 재생.

- [ ] **Step 7: 커밋**

```powershell
git add frontend/player.html frontend/js/player.js frontend/css/style.css
git rm frontend/js/channels.js
git commit -m "feat(phase4): load channels from DB, render thumbnails, admin link"
```

---

### Task 4: admin.html + admin.js — 관리자 CRUD

목표: 관리자만 접근하는 채널 관리 화면을 만든다.

**Files:**
- Create: `frontend/admin.html`, `frontend/js/admin.js`
- Modify: `frontend/css/style.css`

**Interfaces:**
- Consumes: `window.Auth`, `window.DB`, `channelFormProblem`.

- [ ] **Step 1: admin.html 작성**

Create `frontend/admin.html`:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>채널 관리 — 방송 스트림</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <header class="app-header">
    <h1>채널 관리</h1>
    <div class="user-box">
      <a class="admin-link" href="player.html">← 플레이어</a>
      <button id="logout-btn" class="logout-btn">로그아웃</button>
    </div>
  </header>
  <main class="app-main">
    <section class="admin-form-wrap">
      <h2 id="form-title">채널 추가</h2>
      <form id="channel-form" class="admin-form">
        <input id="f-name" placeholder="이름" />
        <select id="f-type">
          <option value="tv">TV</option>
          <option value="radio">라디오</option>
        </select>
        <input id="f-path" placeholder="경로 (예: live/tv1)" />
        <input id="f-thumb" placeholder="썸네일 URL (선택)" />
        <input id="f-sort" type="number" placeholder="정렬" value="0" />
        <label class="chk"><input id="f-enabled" type="checkbox" checked /> 노출</label>
        <div class="admin-form-btns">
          <button type="submit">저장</button>
          <button type="button" id="new-btn">새로 입력</button>
        </div>
      </form>
      <p id="admin-msg" class="auth-msg"></p>
    </section>
    <section>
      <table class="admin-table">
        <thead><tr><th>순서</th><th>이름</th><th>타입</th><th>경로</th><th>노출</th><th></th></tr></thead>
        <tbody id="admin-list"></tbody>
      </table>
    </section>
  </main>
  <script src="js/config.js"></script>
  <script src="js/supabase.min.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/db.js"></script>
  <script src="js/channelform.js"></script>
  <script src="js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: admin.js 작성**

Create `frontend/js/admin.js`:
```js
(function () {
  var listEl = document.getElementById('admin-list');
  var form = document.getElementById('channel-form');
  var msg = document.getElementById('admin-msg');
  var editingId = null;

  function setMsg(t, err) { msg.textContent = t; msg.className = 'auth-msg ' + (err ? 'err' : 'ok'); }

  function readFields() {
    return {
      name: document.getElementById('f-name').value.trim(),
      type: document.getElementById('f-type').value,
      path: document.getElementById('f-path').value.trim(),
      thumbnail_url: document.getElementById('f-thumb').value.trim() || null,
      sort_order: parseInt(document.getElementById('f-sort').value, 10) || 0,
      enabled: document.getElementById('f-enabled').checked
    };
  }
  function fillForm(ch) {
    editingId = ch ? ch.id : null;
    document.getElementById('f-name').value = ch ? ch.name : '';
    document.getElementById('f-type').value = ch ? ch.type : 'tv';
    document.getElementById('f-path').value = ch ? ch.path : '';
    document.getElementById('f-thumb').value = ch && ch.thumbnail_url ? ch.thumbnail_url : '';
    document.getElementById('f-sort').value = ch ? ch.sort_order : 0;
    document.getElementById('f-enabled').checked = ch ? ch.enabled : true;
    document.getElementById('form-title').textContent = ch ? '채널 수정' : '채널 추가';
  }

  async function refresh() {
    listEl.innerHTML = '';
    var channels = await DB.listChannels({ all: true });
    channels.forEach(function (ch) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + ch.sort_order + '</td><td>' + ch.name + '</td><td>' + ch.type +
        '</td><td>' + ch.path + '</td><td>' + (ch.enabled ? '✓' : '—') + '</td>';
      var td = document.createElement('td');
      var edit = document.createElement('button');
      edit.textContent = '수정';
      edit.addEventListener('click', function () { fillForm(ch); });
      var del = document.createElement('button');
      del.textContent = '삭제';
      del.addEventListener('click', async function () {
        if (!confirm('삭제할까요?')) { return; }
        try { await DB.deleteChannel(ch.id); refresh(); }
        catch (e) { setMsg('삭제 실패: ' + e.message, true); }
      });
      td.appendChild(edit); td.appendChild(del); tr.appendChild(td);
      listEl.appendChild(tr);
    });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = readFields();
    var problem = channelFormProblem(f);
    if (problem) { setMsg(problem, true); return; }
    try {
      if (editingId) { await DB.updateChannel(editingId, f); setMsg('수정됨', false); }
      else { await DB.createChannel(f); setMsg('추가됨', false); }
      fillForm(null); refresh();
    } catch (e2) { setMsg('저장 실패: ' + e2.message, true); }
  });
  document.getElementById('new-btn').addEventListener('click', function () { fillForm(null); });
  document.getElementById('logout-btn').addEventListener('click', async function () {
    await Auth.signOut(); window.location.replace('index.html');
  });

  // 가드: 로그인 + 관리자만
  (async function init() {
    var session = await Auth.requireAuth();
    if (!session) { return; }
    if (!(await DB.isAdmin())) { window.location.replace('player.html'); return; }
    fillForm(null);
    refresh();
  })();
})();
```

- [ ] **Step 3: 관리 폼/테이블 스타일 추가**

`frontend/css/style.css` 끝에 추가:
```css
.admin-form-wrap { margin-bottom:20px; }
.admin-form { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.admin-form input, .admin-form select { padding:8px; border-radius:8px; border:1px solid #3a4150;
  background:#0f1115; color:var(--text); font-size:14px; }
.admin-form .chk { color:var(--muted); font-size:14px; }
.admin-form-btns { display:flex; gap:8px; }
.admin-form button { padding:8px 14px; border:none; border-radius:8px; background:var(--accent);
  color:#04121f; font-weight:700; cursor:pointer; }
.admin-table { width:100%; border-collapse:collapse; font-size:14px; }
.admin-table th, .admin-table td { text-align:left; padding:8px; border-bottom:1px solid #262b34; }
.admin-table button { margin-right:6px; padding:4px 10px; border:1px solid #3a4150; border-radius:6px;
  background:transparent; color:var(--text); cursor:pointer; font-size:13px; }
```

- [ ] **Step 4: 관리자 CRUD 검증 (관리자 로그인)**

관리자 계정으로 `http://localhost:8080/admin.html`:
- 채널 목록(전체) 표시.
- 추가: 이름/경로 입력 후 저장 → 목록에 추가. 잘못된 입력은 인라인 에러.
- 수정: 행 "수정" → 폼에 채워짐 → 저장 → 반영.
- 삭제: "삭제" → 확인 → 제거.
- player.html 새로고침 시 변경이 반영됨.

- [ ] **Step 5: 비관리자 차단 검증**

(비관리자 계정이 있으면) 그 계정으로 `admin.html` 접근 → `player.html`로 리다이렉트.
또한 콘솔에서 `await DB.createChannel({name:'x',type:'tv',path:'p',sort_order:0,enabled:true})` 시도 →
RLS로 에러(권한 없음) 반환 확인. (비관리자 계정이 없으면 이 스텝은 계정 생성 후 확인)

- [ ] **Step 6: 커밋**

```powershell
git add frontend/admin.html frontend/js/admin.js frontend/css/style.css
git commit -m "feat(phase4): admin channel CRUD screen (gated by is_admin)"
```

---

### Task 5: 문서화 (README-phase4)

목표: 스키마·관리자 지정·관리 화면 사용법을 정리한다.

**Files:**
- Create: `README-phase4.md`

- [ ] **Step 1: README-phase4.md 작성**

Create `README-phase4.md`:
```markdown
# Phase 4 — 채널 관리 + UI 다듬기 가이드

## 구성
- 채널은 Supabase `channels` 테이블에서 로드(하드코딩 제거).
- 관리자(`profiles.is_admin=true`)만 `admin.html`에서 채널 CRUD.
- 권한은 RLS로 서버에서 강제(비관리자는 DB 쓰기 불가).

## 최초 설정 (Supabase SQL Editor)
docs/superpowers/plans/2026-07-03-phase4-channel-management.md 의 Task 0 SQL 실행:
- channels/profiles 테이블, is_admin() 함수, 가입 트리거, RLS 정책, 시드 채널
- 본인 계정을 관리자로: profiles.is_admin = true (이메일로 지정)

## 관리자 지정
Supabase SQL Editor:
    update public.profiles set is_admin = true
      where user_id = (select id from auth.users where email = 'YOUR-EMAIL');

## 채널 관리
- 관리자로 로그인 → player 헤더의 "관리" 링크 또는 /admin.html
- 추가/수정/삭제. 필드: 이름, 타입(tv/radio), 경로(live/xxx), 썸네일 URL(선택), 정렬, 노출
- 썸네일 URL이 있으면 카드에 이미지, 없으면 기본 카드

## 파일
```
frontend/admin.html, js/admin.js   관리자 CRUD
frontend/js/db.js                  Supabase 쿼리 헬퍼(window.DB)
frontend/js/channelform.js         폼 검증 순수함수(+ test)
frontend/js/player.js              DB에서 채널 로드
(삭제) frontend/js/channels.js     하드코딩 목록
```

## 범위/다음
- 이미지 업로드(Storage), 사용자별 시청 채널 제한은 이후.
- 다음: Phase 5 — 공개 배포(Oracle Cloud + 도메인 + Caddy HTTPS).
```

- [ ] **Step 2: 커밋**

```powershell
git add README-phase4.md
git commit -m "docs(phase4): add channel management guide"
```

---

## 완료 기준 (Phase 4 전체)

- [ ] `node test/channelform.test.js` 통과
- [ ] player가 DB에서 채널을 로드해 표시(썸네일 포함, 정렬)
- [ ] 관리자가 admin.html에서 채널 추가/수정/삭제 가능
- [ ] 비관리자는 admin.html 접근 시 player로 리다이렉트, DB 쓰기 RLS 차단
- [ ] 관리자에게만 player 헤더 "관리" 링크 노출

이 기준이 충족되면 Phase 5(공개 배포)로 진행한다.
