# Phase 3 — Supabase 로그인 가이드

로그인한 사용자만 player 페이지에 접근하도록 인증을 얹었다.

## 구성
- 진입점: `index.html` (로그인/회원가입/비번재설정)
- `player.html`: 로드 시 세션 확인, 미로그인 시 `index.html`로 리다이렉트
- Supabase Auth(호스티드) + supabase-js 로컬 UMD (`js/supabase.min.js`)
- 접근 차단은 **클라이언트(UI) 수준** — 스트림 주소 자체 보호는 Phase 6(서명 URL)

## 설정 파일 (env 역할)
빌드 없는 브라우저 앱이라 `.env` 대신 `js/config.js`가 설정을 담는다.
- `js/config.example.js` — 커밋되는 예시 템플릿
- `js/config.js` — 실제 키(로컬, **.gitignore로 제외**)

처음 세팅:
```powershell
Copy-Item frontend\js\config.example.js frontend\js\config.js
# 그다음 config.js 의 두 값을 채운다
```
값 위치: Supabase → Project Settings(⚙️) → API의 `Project URL`, `anon public` key.

## Supabase 대시보드 설정 (최초 1회)
1. Authentication → Providers → **Email** 활성화, **Confirm email** ON
2. Authentication → **URL Configuration**
   - Site URL: `http://localhost:8080`
   - Redirect URLs: `http://localhost:8080/**`, `http://192.168.*.*:8080/**`
   - (확인 메일/재설정 메일 링크가 우리 앱으로 되돌아오게 하는 허용 목록)

> 테스트만 빠르게 하려면: Confirm email을 잠깐 OFF 하거나,
> Authentication → Users → **Add user**로 "Auto Confirm User"를 켜서 계정을 만들면
> 확인 메일 없이 바로 로그인할 수 있다.

## 실행
```powershell
.\bin\mediamtx.exe .\mediamtx.yml
.\bin\caddy.exe run --config Caddyfile --adapter caddyfile
```
접속: `http://localhost:8080/`  (index.html)

## 흐름
- 회원가입 → 확인 메일 링크 클릭 → 로그인 → `player.html`
- 로그아웃(우상단 버튼) → `index.html`
- 비밀번호 재설정: 로그인 화면에서 이메일 입력 → "비밀번호 재설정" → 메일 링크 → 새 비밀번호

## 파일
```
frontend/
  index.html          로그인/회원가입/비번재설정 진입점
  player.html         (가드) requireAuth + 로그아웃/이메일
  js/config.js        Supabase URL/anon key (로컬, gitignore)
  js/config.example.js  설정 예시(커밋)
  js/supabase.min.js  supabase-js UMD
  js/auth.js          window.Auth 인증 헬퍼
  js/login.js         index 페이지 로직
  js/validate.js      입력 검증 순수함수
test/validate.test.js  검증 유닛 테스트 (node)
```

## 검증 완료
- [x] `node test/validate.test.js` 통과
- [x] Supabase 클라이언트 초기화·통신 (Invalid credentials 응답 확인)
- [x] 입력 검증·화면 전환 UI 동작
- [x] 미로그인 시 player.html → index.html 리다이렉트(가드)
- [ ] 실제 계정 로그인 → player 표시 → 로그아웃 (사용자 계정으로 최종 확인)
- [ ] 확인 메일/비번 재설정 메일 흐름 (Redirect URL 설정 후)

## 한계 / 다음
- 클라이언트 가드만 있으므로 스트림 URL 직접 접근은 아직 가능 → **Phase 6(서명 URL)**.
- 사용자 권한 등급/시청 가능 채널 → **Phase 4**.
- 다음 단계: **Phase 4 — 채널 DB화(Supabase) + 썸네일/온에어 + UX**.
