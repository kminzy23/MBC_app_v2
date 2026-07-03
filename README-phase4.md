# Phase 4 — 채널 관리 + UI 다듬기 가이드

## 구성
- 채널은 Supabase `channels` 테이블에서 로드(하드코딩 제거).
- 관리자(`profiles.is_admin=true`)만 `admin.html`에서 채널 CRUD.
- 권한은 RLS로 서버에서 강제(비관리자는 DB 쓰기 불가).

## 최초 설정 (Supabase SQL Editor)
`docs/superpowers/plans/2026-07-03-phase4-channel-management.md`의 Task 0 SQL 실행:
- channels/profiles 테이블, `is_admin()` 함수, 가입 트리거, RLS 정책, 시드 채널
- (참고) `drop policy/trigger if exists`·`alter table` 때문에 "destructive" 경고가 뜨지만,
  기존 데이터를 지우지 않는다. 단, 시드 INSERT가 있으니 **한 번만** 실행할 것.

## 관리자 지정
Supabase SQL Editor에서 본인 이메일로:
```
update public.profiles set is_admin = true
  where user_id = (select id from auth.users where email = 'YOUR-EMAIL');
```

## 채널 관리
- 관리자로 로그인 → player 헤더의 "관리" 링크 또는 `/admin.html`
- 추가/수정/삭제. 필드: 이름, 타입(tv/radio), 경로(`live/xxx`), 썸네일 URL(선택), 정렬, 노출
- 썸네일 URL이 있으면 카드에 이미지, 없으면 기본 카드

## 파일
```
frontend/admin.html, js/admin.js   관리자 CRUD
frontend/js/db.js                  Supabase 쿼리 헬퍼(window.DB)
frontend/js/channelform.js         폼 검증 순수함수(+ test)
frontend/js/player.js              DB에서 채널 로드
(삭제) frontend/js/channels.js     하드코딩 목록
```

## 검증 완료
- [x] `node test/channelform.test.js` 통과
- [x] player가 DB에서 채널 로드·표시(정렬)
- [x] 관리자 admin.html에서 추가/수정/삭제
- [x] 관리자에게만 "관리" 링크 노출
- [ ] 비관리자 admin 접근 차단·RLS 쓰기 차단 (2번째 비관리자 계정으로 추후 확인)

## 범위/다음
- 이미지 업로드(Storage), 사용자별 시청 채널 제한은 이후.
- 다음: **Phase 5 — 공개 배포(Oracle Cloud + 도메인 + Caddy HTTPS)**.
