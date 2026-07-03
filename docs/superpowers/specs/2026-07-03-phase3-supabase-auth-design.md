# Phase 3 설계 — Supabase 로그인

> 방송 스트림 모니터링 앱의 세 번째 단계. 로그인한 사용자만 플레이어에 접근하게 한다.
> 상위 계획: `방송 스트림 모니터링 앱_구현계획서.md` / 선행: Phase 2 (웹 플레이어)

## 목표

이메일/비밀번호 기반 로그인을 얹어, 로그인한 사용자만 player 페이지를 보고 채널을
재생할 수 있게 한다. 이 단계의 접근 차단은 **클라이언트(UI) 수준**이다(미로그인 시
리다이렉트). 스트림 주소 자체를 막는 서명 URL은 Phase 6에서 다룬다.

## 확정 사항

| 항목 | 결정 |
|------|------|
| 인증 방식 | 이메일 + 비밀번호 (Supabase Auth) |
| 회원가입 | 누구나 공개 가입 |
| 이메일 인증 | 켬 (확인 메일 발송) |
| 접근 차단 | 클라이언트 수준 리다이렉트 (스트림 차단은 Phase 6) |
| Supabase JS | UMD 로컬 파일 `js/supabase.min.js` (hls.js와 동일 방식) |
| 사용자/권한 테이블 | Phase 4로 보류 (지금은 Supabase 기본 auth.users만) |

## 아키텍처 / 흐름

```
index.html (로그인·회원가입·비번재설정)  ← 새 진입점
   │  signUp / signInWithPassword (Supabase Auth)
   │  로그인 성공 → player.html
   ▼
player.html (auth.js가 세션 확인)
   세션 있음 → 재생 / 없음 → index.html로 리다이렉트
   로그아웃 버튼 → signOut → index.html
```

- Supabase는 외부 호스티드 서비스(`*.supabase.co`). 클라이언트는 anon key(공개용, 커밋 안전)로 접근.
- 세션은 supabase-js가 localStorage에 보관한다.
- 확인 메일 링크 redirect는 Supabase 대시보드(Authentication → URL Configuration)에서
  우리 로컬 주소(`http://localhost:8080`, `http://<PC-IP>:8080`)로 설정한다. WiFi로 IP가
  바뀌므로 필요한 주소를 추가하거나 와일드카드(`http://192.168.*.*:8080`)를 사용한다.

## 파일 구조 (추가/수정)

```
frontend/
  index.html          # (신규) 로그인/회원가입/비번재설정, 진입점
  player.html         # (수정) 로그아웃 버튼 + auth 가드
  js/
    config.js         # (신규) SUPABASE_URL, SUPABASE_ANON_KEY
    supabase.min.js   # (신규) supabase-js UMD 로컬
    auth.js           # (신규) 클라이언트 init + signup/login/logout/세션가드/비번재설정
    validate.js       # (신규) 이메일/비번 형식 검증 순수함수 (node 테스트)
  css/style.css       # (수정) 로그인 폼 스타일
```

책임 분리:
- **config.js**: 설정값만 (`window.SUPABASE_URL`, `window.SUPABASE_ANON_KEY`).
- **validate.js**: 폼 입력 검증 순수함수 (`isValidEmail`, `passwordProblem`). DOM/네트워크 없음.
- **auth.js**: Supabase 클라이언트와 인증 동작. DOM 최소.
- **index.html / player.html**: 마크업 + 각 페이지 진입 로직.

## 컴포넌트 & 인터페이스

### validate.js
- `isValidEmail(s)` → boolean. 기본 이메일 형식 검사.
- `passwordProblem(pw)` → string|null. 문제 있으면 사유 문자열(예: "비밀번호는 6자 이상"), 없으면 null.

### auth.js
- `const sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)`
- `signUp(email, pw)` → Supabase `auth.signUp`. 확인 메일 발송.
- `signIn(email, pw)` → `auth.signInWithPassword`. 성공 시 호출부가 player.html로 이동.
- `signOut()` → `auth.signOut`.
- `getSession()` → 현재 세션(또는 null).
- `requireAuth()` → 세션 없으면 `index.html`로 리다이렉트(가드). player.html이 로드 시 호출.
- `sendPasswordReset(email)` → `auth.resetPasswordForEmail`, redirect는 index.html.

### index.html
- 로그인/회원가입 폼 전환, 에러·안내 메시지 영역, "비밀번호 재설정" 링크.
- URL에 복구/확인 토큰이 있으면(비번 재설정 흐름) "새 비밀번호 입력" 폼을 노출.

### player.html
- 로드 시 `requireAuth()`.
- 상단에 로그인 이메일 표시 + 로그아웃 버튼.

## 에러/상태 처리

- Supabase 인증 에러를 친화적 메시지로 변환: 잘못된 자격증명, 미확인 이메일, 약한 비밀번호, 중복 가입 등.
- 제출 중 로딩 표시, 성공/실패 안내 문구.

## 테스트

- `validate.js` 순수함수 → `test/validate.test.js` (node, 프레임워크 없이 assert).
- 로그인/회원가입/가드 흐름 → Playwright로 검증. 이메일 확인이 ON이므로, 검증에는
  확인 완료된 계정 하나를 사용하거나 잠시 Confirm email을 꺼서 테스트한다.

## 완료 기준

- 로그인해야만 player 페이지가 보이고 채널을 재생할 수 있다.
- 미로그인 상태로 player.html 접근 시 로그인 화면으로 리다이렉트된다.
- 로그아웃하면 다시 로그인 화면으로 간다.

## 범위 밖 (이후 Phase)

- 사용자 권한 등급·시청 가능 채널 (Phase 4)
- 스트림 주소 자체 차단 = 서명 URL (Phase 6)

## 결정 근거 요약

- **클라이언트 가드만**: 계획서가 "초기엔 로그인해야 페이지가 보인다 수준"으로 명시. 실제
  스트림 보호는 Phase 6. YAGNI.
- **anon key 커밋**: 공개용 키로 설계상 클라이언트에 노출된다. 데이터 보호는 RLS 담당(아직
  커스텀 테이블 없음).
- **supabase-js 로컬 UMD**: 외부 런타임 의존 없이 오프라인·PWA(Phase 7)에 유리. hls.js와 일관.
