# 디자인 브리프 — 부산MBC 온에어 (웹앱 UI 고도화)

> 이 문서는 **디자인 도구(Claude 등)에 그대로 붙여넣어** 기존 웹앱의 UI를 더 완성도 높게
> 다듬기 위한 브리프다. 목표는 "동작은 그대로, 보기·감성만 프리미엄하게"다.
> **핵심 제약을 먼저 읽을 것**: 이 앱은 빌드 도구 없는 순수 HTML/CSS/JS이고, JS가 특정
> id/class에 붙어 있어 **그 훅을 유지해야 로그인·영상 재생이 깨지지 않는다.**

---

## 1. 제품 개요

- **부산MBC 온에어** — 방송국(부산MBC) TV/라디오를 **로그인한 시청자가 휴대폰으로 실시간 시청**하는 웹앱.
- 이미 배포·운영 중: `https://mybusanmbc.duckdns.org` (HTTPS).
- 최근 **라이트 MBC 브랜드 테마 + PWA(홈 화면 설치)** 로 1차 리스킨 완료. 이번엔 **디자인 퀄리티 상향**이 목표.
- 성격: 공공 방송사 서비스. **신뢰감 + 친근함(마스코트)** 이 공존해야 함. 모바일 우선.

## 2. 디자인 목표

1. **프리미엄한 완성도** — 여백·타이포 위계·컴포넌트 디테일(그림자·라운드·상태)·마이크로 인터랙션.
2. **브랜드 일관성** — MBC 퍼플 + MBC NEW 폰트 + 마스코트를 세련되게 활용.
3. **라이트 테마 유지** (다크 아님). 방송 영상 영역만 검정.
4. **모바일 우선 / iOS Safari 최적화 / PWA 전체화면(standalone)** 에서 자연스럽게.
5. **접근성** — 텍스트 대비 WCAG AA, 터치 타깃 44px+.

## 3. 브랜드 시스템

### 컬러 (MBC 공식 팔레트)
메인:
- **MBC Purple `#6706D3`** — 주 강조(버튼/헤더/링크/포인트)
- MBC Medium Purple `#8F83FF` — 보조/hover/그라데이션
- MBC Purple Super Dark `#29153C` — 진한 텍스트/딥 배경

서브:
- **MBC Red `#FF4141`** — **온에어(라이브) 표시**
- MBC Blue `#4664E6` — 링크/보조 강조
- MBC Blue Super Dark `#15183C`

추가(뱃지/일러스트 악센트용): Pink `#FFBED2`, Yellow `#FFDA73`, Sky Blue `#8CC8FF`, Green `#46BE8C`, Medium Blue `#7B85FF`, Red Dark `#C33232`, Blue Dark `#3250C8`

라이트 테마 중립:
- 배경 `#f4f2f8`(연퍼플 그레이), 카드 `#ffffff`, 본문 텍스트 `#1f1a2b`, 뮤트 `#6f6b7a`, 보더 `#e7e3f0`

### 타이포그래피
- **MBC NEW** 서체 사용 (둥글고 친근한 고딕). 굵기: Light/Medium/SemiBold/Bold.
  - 파일: `frontend/fonts/MBCNEW-M.ttf`(본문), `frontend/fonts/MBCNEW-B.ttf`(제목). (원본 전체 굵기는 `assets/fonts/MBC NEW *.ttf`)
- 위계 예시: 화면 타이틀 800/22–26px, 섹션 제목 700/15–16px, 본문 400–500/14–15px.

### 마스코트
- 파란 로봇/TV 캐릭터(엠빅 스타일). **투명 배경 PNG**: `frontend/images/mascot.png`.
  - (원본 `assets/images/MBC_icon.jpg`는 검정 배경 → 투명 처리본이 mascot.png. 다른 포즈: `assets/images/MBC_icon2.jpg`)
- 로그인 화면 상단·헤더 로고·PWA 아이콘에 사용 중. 로딩/빈 상태/온에어 연출 등에 더 활용 가능.

### 톤 & 무드
- 공공 방송의 **신뢰감** + 마스코트의 **친근·경쾌함**. 과하지 않은 컬러, 넉넉한 여백, 부드러운 라운드(10–16px), 은은한 그림자.

## 4. 기술 제약 (반드시 준수 — 어기면 앱이 깨짐)

- **빌드 도구 없음**: 순수 HTML/CSS/JS. 프레임워크·번들러·전처리기(SCSS 등) 도입 불가. **바닐라 CSS**로 작성.
- **파일 구조**: `frontend/index.html`(로그인), `frontend/player.html`(플레이어), `frontend/admin.html`(관리), 공용 `frontend/css/style.css`. 스타일은 원칙적으로 **style.css 한 곳**에서.
- **스크립트/DOM 로직은 변경 금지**. 마크업을 다듬되 **아래 5·6절의 id/class 훅을 반드시 유지**.
- **모바일 우선**, iOS Safari 네이티브 재생 고려. **PWA standalone**(주소창 없는 전체화면)에서 헤더가 상태바와 겹치지 않게(상단 safe-area 여백 고려: `env(safe-area-inset-top)`).
- **영상 플레이어 배경은 검정 유지**(`<video class="video">`).
- 이미지/폰트는 로컬 파일만(외부 CDN 금지 — CSP/오프라인 정책). 폰트는 이미 `@font-face`로 임베드됨.

## 5. 화면 인벤토리 (현재 구조 + 개선 포인트)

### A. 로그인/가입/재설정 — `index.html`
현재 구조:
```
main.auth-wrap
  div.auth-brand > img(mascot) + h1.auth-title("부산MBC 온에어")
  form#login-form.auth-form      → h2, input#login-email, input#login-pw, button, a#to-signup.auth-link, a#to-reset.auth-link
  form#signup-form.auth-form.hidden → h2, input#signup-email, input#signup-pw, button, a#to-login.auth-link
  form#reset-form.auth-form.hidden  → h2, input#reset-pw, button
  p#auth-msg.auth-msg            (성공 시 .ok / 실패 시 .err 클래스가 JS로 붙음)
```
개선 포인트: 브랜드 히어로(마스코트 활용) 감성, 입력 필드/버튼 디테일, 폼 전환(로그인↔가입) 매끄러움, 에러/성공 메시지 스타일.

### B. 플레이어(메인) — `player.html`
현재 구조:
```
header.app-header
  div.brand > img.brand-logo(mascot) + h1("부산MBC 온에어")
  div.user-box > a#admin-link.admin-link.hidden("관리") + span#user-email.user-email + button#logout-btn.logout-btn
main.app-main
  section.player-area            (라디오 채널이면 .mode-radio 클래스가 JS로 추가됨)
    video#player.video[controls playsinline]
    div#player-status.player-status   ("재생 중"/"오프에어" 등 텍스트를 JS가 갱신)
  section.channels
    h2.channels-title("채널")
    ul#channel-list.channel-list   ← 카드가 JS로 주입됨(아래 카드 구조)
```
JS가 만드는 채널 카드 구조(이 클래스/구조 유지):
```
li.channel-card.channel-<tv|radio>[data-id]
  img.channel-thumb(있을 때만)
  span.channel-name
  span.channel-type("TV"/"라디오")
  span.channel-status[data-status]   ← 상태에 따라 .on-air(레드) / .off-air(그레이) 클래스가 붙음
```
개선 포인트: 플레이어 카드/컨트롤 주변 정리, 채널 카드 그리드의 시각적 매력(썸네일, 온에어 뱃지 강조), 라디오 모드 아트워크, 로딩/오프에어 상태 표현.

### C. 관리(관리자 전용) — `admin.html`
현재 구조:
```
header.app-header(브랜드 + a.admin-link "← 플레이어" + button#logout-btn)
main.app-main
  section.admin-form-wrap
    h2#form-title("채널 추가"/"채널 수정")
    form#channel-form.admin-form
      input#f-name, select#f-type(option tv/radio), input#f-path, input#f-thumb, input#f-sort(number),
      label.chk > input#f-enabled(checkbox) "노출",
      div.admin-form-btns > button[type=submit]"저장" + button#new-btn"새로 입력"
    p#admin-msg.auth-msg
  section > table.admin-table (thead: 순서/이름/타입/경로/노출/빈칸; tbody#admin-list ← JS 주입, 각 행에 "수정"/"삭제" 버튼)
```
개선 포인트: 폼/테이블 가독성, 반응형 테이블(모바일), 액션 버튼 위계. (관리 화면도 브랜드 일관성 유지)

## 6. 절대 유지해야 할 코드 훅 (JS가 참조 — 이름/구조 보존)

**ID (변경·삭제 금지):**
`login-form, signup-form, reset-form, login-email, login-pw, signup-email, signup-pw, reset-pw, to-signup, to-reset, to-login, auth-msg, player, player-status, channel-list, user-email, logout-btn, admin-link, form-title, channel-form, f-name, f-type, f-path, f-thumb, f-sort, f-enabled, new-btn, admin-msg, admin-list`

**JS가 토글/의존하는 class·속성 (보존):**
- `.hidden` (폼 표시/숨김 전환)
- `.player-area.mode-radio` (라디오일 때 추가)
- 채널 카드: `.channel-card`, `.channel-name`, `.channel-type`, `.channel-status`, `.channel-thumb`, `.on-air`, `.off-air`, 속성 `data-id`, `data-status`
- 메시지: `.auth-msg` + `.ok` / `.err`
- `<video>`는 `id="player"` + `controls playsinline` 유지, 컨테이너 클래스 `.video`(검정 배경).

> 디자인 자유도: **위 훅만 유지하면**, 클래스 추가·래퍼 요소 추가·스타일 전면 개편·style.css 재작성 모두 OK. 새 장식용 요소/아이콘/클래스는 얼마든지 추가 가능.

## 7. 원하는 산출물

1. **개편된 `frontend/css/style.css`** (바닐라 CSS, 위 브랜드 시스템 반영, 반응형).
2. 필요 시 **세 HTML의 표현용 마크업 보강**(훅 유지 전제) — 예: 히어로 래퍼, 아이콘, 상태 뱃지 구조.
3. (선택) 재사용 토큰: CSS 변수로 컬러/간격/라운드/그림자 정의.
4. 변경 요약(무엇을 왜 바꿨는지) 한눈에.

## 8. 범위 밖 / 하지 말 것

- JS 로직·인증(Supabase)·HLS 재생 흐름 변경 금지. 빌드 도구/프레임워크 도입 금지. 외부 CDN 리소스 금지.
- 다크 테마로 회귀 금지. 영상 영역 검정 배경 제거 금지.

## 9. 에셋 경로 (참고)

- 컬러 팔레트 원본: `assets/images/brand color code.png`
- 폰트: `assets/fonts/MBC NEW {L,M,SB,B}.ttf` (임베드본 `frontend/fonts/MBCNEW-{M,B}.ttf`)
- 마스코트: `frontend/images/mascot.png`(투명), 원본 `assets/images/MBC_icon.jpg`, 다른 포즈 `assets/images/MBC_icon2.jpg`
- PWA 아이콘: `frontend/icons/icon-{180,192,512,maskable-512}.png`

## 10. 내가 채울 취향/방향 (선택 — 있으면 여기에 적어 넣기)

- 참고하고 싶은 앱/사이트 무드: ________
- 강조하고 싶은 느낌(예: 미니멀·발랄·정보밀도 높게·큼직한 카드 등): ________
- 특히 공들이고 싶은 화면(로그인 / 플레이어 / 채널목록 / 관리): ________
