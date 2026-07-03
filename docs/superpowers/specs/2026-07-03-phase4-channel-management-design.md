# Phase 4 설계 — 채널 관리 + UI 다듬기

> 방송 스트림 모니터링 앱의 네 번째 단계. 채널을 Supabase DB에서 불러오고, 관리자만
> 앱 안에서 채널을 CRUD 할 수 있게 한다.
> 상위 계획: `방송 스트림 모니터링 앱_구현계획서.md` / 선행: Phase 3 (Supabase 로그인)

## 목표

하드코딩된 채널 목록(`channels.js`)을 Supabase DB에서 불러오도록 바꾸고, 관리자만 앱 안
관리 화면에서 채널을 추가·수정·삭제할 수 있게 한다. 썸네일 표시와 정렬을 붙인다.
재생 오류 처리·로딩·라디오 분기는 Phase 2에서 이미 구현됨.

## 확정 사항

| 항목 | 결정 |
|------|------|
| 채널 저장 | Supabase `channels` 테이블 |
| 관리자 구분 | `profiles` 테이블 + `is_admin` 플래그, **RLS로 서버 강제** |
| 관리 화면 | 앱 안 `admin.html` (관리자 전용 CRUD) |
| 썸네일 | `thumbnail_url` 필드(비면 기본 카드). 파일 업로드는 범위 밖 |
| 온에어 상태 | 기존 방식 유지(클라이언트가 m3u8 probe) |

## 데이터 모델 (Supabase)

### channels
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK (default gen_random_uuid()) | |
| name | text not null | 채널 이름 |
| type | text not null | `'tv'` \| `'radio'` |
| path | text not null | MediaMTX 경로 (예: `live/tv1`) |
| thumbnail_url | text | 썸네일 이미지 주소(nullable) |
| sort_order | int not null default 0 | 정렬 순서 |
| enabled | bool not null default true | 노출 여부 |
| created_at | timestamptz default now() | |

### profiles
| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | uuid PK, FK→auth.users | |
| is_admin | bool not null default false | 관리자 여부 |
| created_at | timestamptz default now() | |

회원가입 시 `profiles` 행을 자동 생성하는 트리거(`handle_new_user`)를 둔다.

## 보안 (RLS)

- SQL 헬퍼 `public.is_admin()` → `exists(select 1 from profiles where user_id = auth.uid() and is_admin)`.
- `channels`:
  - SELECT: 로그인 사용자(`authenticated`) 누구나.
  - INSERT/UPDATE/DELETE: `is_admin()` 인 경우만.
- `profiles`:
  - SELECT: 본인 행만(`user_id = auth.uid()`).
  - `is_admin` 값은 클라이언트에서 변경 불가(업데이트 정책 없음 → 대시보드/서비스롤만 변경).

> 관리자 판정이 DB에 저장되고 RLS로 강제되므로, 클라이언트 코드를 조작해도 비관리자는
> channels를 쓸 수 없다.

## 아키텍처 / 파일

```
frontend/
  admin.html        (신규) 관리자 채널 CRUD 화면
  player.html       (수정) DB에서 채널 로드, 관리자면 '관리' 링크 노출
  js/
    db.js           (신규) Supabase 쿼리 헬퍼
    admin.js        (신규) 관리자 페이지 로직(가드 + CRUD)
    channelform.js  (신규) 채널 폼 검증 순수함수(node 테스트)
    player.js       (수정) db.listChannels() 사용, 썸네일 렌더
  js/channels.js    (삭제) 하드코딩 목록 제거
  css/style.css     (수정) 썸네일/관리 폼 스타일
test/
  channelform.test.js (신규) 폼 검증 유닛 테스트
```

### db.js (인터페이스)
- `listChannels(opts)` → Promise<채널[]> (기본 enabled=true, sort_order 오름차순; `opts.all=true`면 전체)
- `createChannel(fields)` → Promise
- `updateChannel(id, fields)` → Promise
- `deleteChannel(id)` → Promise
- `isAdmin()` → Promise<boolean> (본인 profiles.is_admin)

채널 객체 형태(기존과 호환): `{ id, name, type, path, thumbnail_url, sort_order, enabled }`.

### channelform.js
- `channelFormProblem(fields)` → string|null. name/path 비었거나 type이 tv/radio가 아니면 사유, 없으면 null.

## 뷰어 흐름 (player)

로그인 → `requireAuth` → `db.listChannels()` → 카드 렌더(썸네일 있으면 `<img>`, 없으면 기존 색상 카드) → 온에어 probe(기존) → 클릭 재생(기존, hls.js/네이티브 분기·복구 유지). `isAdmin()`이면 헤더에 "관리" 링크 표시.

## 관리자 흐름 (admin.html)

로그인 → `requireAuth` → `isAdmin()` 확인 → 관리자 아니면 `player.html`로 리다이렉트 →
채널 목록 표 + 추가/수정/삭제 폼. 저장 시 db.js로 반영. 비관리자는 RLS가 서버에서 차단.

## 에러/상태 처리

- 채널 로드 실패: 에러 메시지 + 로딩 표시.
- 폼 검증: `channelFormProblem`으로 제출 전 확인, 서버 에러는 메시지로 노출.

## 테스트

- `channelform.js` → `test/channelform.test.js` (node, assert).
- 흐름 → Playwright: 뷰어가 DB 채널을 보는지, 관리자 CRUD 동작, 비관리자 admin 접근 시
  리다이렉트 + 쓰기 RLS 차단(비관리자 createChannel 시 에러) 검증.

## 완료 기준

- 채널이 DB에서 로드되어 표시된다(썸네일 포함, sort_order 정렬).
- 관리자는 앱에서 채널을 추가·수정·삭제할 수 있다.
- 비관리자는 admin 화면 접근이 차단되고, DB 쓰기도 RLS로 막힌다.

## 범위 밖 (이후)

- 이미지 파일 업로드(Supabase Storage) — 지금은 URL 필드
- 사용자별 시청 가능 채널 제한
- 서명 URL(Phase 6), 공개 배포(Phase 5)

## 결정 근거 요약

- **RLS 기반 관리자**: 권한을 DB에 두고 서버에서 강제해야 실제 방어가 된다. 이메일
  하드코딩은 화면 숨김일 뿐 DB 쓰기를 막지 못한다.
- **썸네일 URL 필드**: DB화·관리 화면이라는 핵심에 집중하면서 썸네일도 지원. 업로드는
  Storage 설정 부담이 있어 이후로.
