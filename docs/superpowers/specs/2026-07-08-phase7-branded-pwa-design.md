# Phase 7 설계 — 부산MBC 온에어 (브랜드 리스킨 + PWA)

> 방송 스트림 모니터링 앱의 일곱 번째 단계. 이미 배포된 웹앱(`https://mybusanmbc.duckdns.org`)을
> **MBC 브랜드의 라이트 테마로 리스킨**하고, **홈 화면에 설치되는 PWA**로 만들어 "앱처럼" 쓰게 한다.
> 상위 계획: `방송 스트림 모니터링 앱_구현계획서.md` (Phase 7) / 선행: Phase 1~5 (배포 완료)

## 목표

1. 현재 다크 테마 웹앱을 **MBC 브랜드(퍼플) 기반 라이트 테마**로 리스킨 (컬러·폰트·마스코트).
2. 아이폰/안드로이드 **홈 화면에 아이콘으로 설치**되고 **주소창 없는 전체화면**으로 실행되는 PWA화.
3. 앱 이름: **부산MBC 온에어**.

> 네이티브 앱(앱스토어)은 Mac이 없어 이번 범위 밖. 단 이 PWA 결과물은 이후 Mac 확보 시
> Capacitor로 감싸 네이티브로 재활용 가능하므로 낭비되지 않는다.

## 현재 상태 / 문제

- 앱은 **웹사이트 형태**(브라우저 접속)이며 **다크 테마**(`style.css`의 `--bg:#0f1115` 등).
- 홈 화면 설치·전체화면·앱 아이콘 개념이 없다(매니페스트·서비스워커 부재).
- 브랜드 요소(MBC 퍼플, MBC NEW 폰트, 마스코트) 미적용.

## 확정 사항

| 항목 | 결정 |
|------|------|
| 앱 이름 | **부산MBC 온에어** (short_name: `MBC 온에어`) |
| 테마 | **라이트**(화이트 배경/진회색 텍스트) + 브랜드 포인트 컬러 |
| 메인 컬러 | **MBC 퍼플 `#6706D3`** (버튼·헤더·링크) |
| 보조 컬러 | 블루 `#4664E6`(링크/강조), **레드 `#FF4141`(온에어)** |
| 폰트 | **MBC NEW**(제목 Bold, 본문 Medium) — `assets/fonts/`에서 웹폰트로 임베드 |
| 아이콘/브랜딩 | 마스코트(`assets/images/MBC_icon.jpg`) → 앱 아이콘·헤더·로그인 |
| PWA | manifest + iOS 메타 + service worker(앱 셸만 캐시) |

### 브랜드 컬러 팔레트 (참고: `assets/images/brand color code.png`)
- MBC-Purple `#6706D3` (103,6,211) — **primary**
- MBC-Medium_Purple `#8F83FF` (143,131,255) — hover/보조 퍼플
- MBC-Purple_Super_Dark `#29153C` (41,21,60) — 진한 텍스트/헤더 대체
- MBC-Blue `#4664E6` (70,100,230) — 링크/보조 강조
- MBC-Red `#FF4141` (255,65,65) — **온에어(라이브) 표시**
- (여분) Pink/Yellow/Sky/Green 등은 필요 시 뱃지 색으로

## 아키텍처 / 구성요소

두 갈래(A. 리스킨, B. PWA)로 나뉘며 서로 독립적이나 한 번에 배포한다.

```
frontend/
  css/style.css            # [수정] 라이트 테마 + @font-face(MBC NEW)
  fonts/                   # [추가] MBC NEW M/B (+L) 웹폰트 파일
  images/mascot.png        # [추가] 마스코트(헤더·로그인용, MBC_icon 기반)
  icons/                   # [추가] PWA 아이콘 180/192/512/maskable
  manifest.json            # [추가] PWA 매니페스트
  service-worker.js        # [추가] 앱 셸 캐시(영상·인증·채널데이터 제외)
  js/pwa.js                # [추가] 서비스워커 등록(공유)
  index.html               # [수정] head 메타·SW등록·마스코트·제목
  player.html              # [수정] 동일
  admin.html               # [수정] 동일(관리 화면도 브랜드 일관)
tools/icon-builder.html    # [추가] 마스코트→아이콘 크기별 생성 도우미(선택)
```

### A. 브랜드 리스킨 (다크 → 라이트)

- **`style.css` 전면 개편**: CSS 변수(`--bg`, `--card`, `--text`, `--muted`, `--accent` 등)를
  라이트 팔레트로 교체. 클래스 이름·구조는 **그대로 유지**(HTML/JS 로직 무영향).
  - `--bg: #ffffff` / `--surface(card): #ffffff`(연한 그림자·테두리) / `--text: #29153C`(또는 `#1c1c22`) /
    `--muted: #6b6b76` / `--accent: #6706D3` / `--accent-2: #4664E6` / `--on-air: #FF4141`
- **@font-face**: `MBC NEW`(Medium=본문, Bold=제목). 폰트 파일은 `frontend/fonts/`에 복사.
  `body { font-family: "MBC NEW", system-ui, sans-serif; }`
- **온에어/오프에어 뱃지**: 온에어=레드(`#FF4141`, 라이브), 오프에어=뮤트 그레이. (현재 녹색/빨강에서 변경)
- **영상 플레이어 영역은 검정 배경 유지**(영상 가독성). 라이트 테마여도 `.video` 배경은 `#000`.
- **헤더/로그인**: 마스코트 이미지 + "부산MBC 온에어" 타이틀로 브랜드감. 헤더 배경은 퍼플 또는 화이트+퍼플 로고.
- 대비: 퍼플 `#6706D3` 위 흰 텍스트 = WCAG AA 통과(대비 6:1↑). 본문 텍스트는 진회색/퍼플다크.

### B. PWA (홈 화면 앱)

- **`manifest.json`**:
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
  - `start_url: /player.html` — 로그인 상태면 채널, 아니면 `requireAuth`가 로그인으로 보냄.
- **아이콘**: 마스코트 기반 **180(iOS apple-touch-icon)·192·512·maskable(안전영역 패딩)** PNG.
  - 생성: 마스코트를 정사각 배경(화이트 또는 연퍼플) 위에 중앙 배치. maskable은 여백 20% 확보.
- **각 HTML `<head>`에 추가**(index/player/admin 공통):
  ```html
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#6706D3">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="부산MBC 온에어">
  <link rel="apple-touch-icon" href="/icons/icon-180.png">
  ```
- **`service-worker.js`** — **앱 셸만** 캐시(오프라인 시 빠른 실행·우아한 안내):
  - precache: `/index.html /player.html /admin.html /css/style.css /js/*.js
    /js/hls.js /js/supabase.min.js /fonts/* /images/mascot.png /icons/*`
  - fetch 전략: **same-origin 정적 자산만** cache-first(+백그라운드 갱신).
    **다음은 절대 가로채지/캐시하지 않음(항상 네트워크)**:
    - `/live/*` (HLS 영상 세그먼트/재생목록 — 라이브)
    - `*.supabase.co` (인증·DB — 교차 출처)
    - `/js/config.js` (설정/키, 변동 가능)
  - `install`: 셸 precache / `activate`: 이전 버전 캐시 정리 / **캐시 버전 문자열**로 갱신 관리.
- **`js/pwa.js`**: `if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js')` — 각 페이지에서 로드.

## 동작 흐름

1. 아이폰 Safari로 `https://mybusanmbc.duckdns.org` 접속 → 라이트 브랜드 UI.
2. 공유 → **"홈 화면에 추가"** → 마스코트 아이콘 + "부산MBC 온에어" 생성.
3. 아이콘 실행 → **전체화면(주소창 없음)** 으로 `start_url` 열림.
4. 서비스워커가 앱 셸 캐시 → 두 번째 실행부터 즉시 로딩. 영상·로그인은 항상 실시간 네트워크.

## 검증 / 테스트

- **회귀**: `node test/*.test.js` 모두 통과(순수 함수 로직 변화 없음).
- **로컬 렌더**: 세 페이지가 라이트 테마·MBC 폰트·마스코트로 표시. 재생/로그인/관리 정상.
- **PWA(크롬 DevTools → Application)**: manifest 유효, SW 등록·활성, "설치 가능". Lighthouse PWA 통과.
- **서비스워커 안전성**: SW 활성 상태에서 **영상 재생·로그인·채널 로드 정상**(라이브 데이터가 캐시로 막히지 않음). 오프라인 시 앱 셸이 뜨고 "연결 없음" 안내.
- **아이폰 실기기**: "홈 화면에 추가" → 아이콘 실행 → 전체화면. 재생까지 확인.
- **배포 반영**: 서버 `git pull` 후 SW **캐시 버전 갱신**으로 새 자산 반영(옛 캐시 안 남게).

## 완료 기준

- 아이폰 홈 화면 **마스코트 아이콘**으로 실행 → **전체화면** 앱 경험.
- 전체 UI가 **MBC 라이트 브랜드**(퍼플·MBC NEW·마스코트)로 일관.
- 서비스워커가 **영상/로그인/채널 데이터를 캐시하지 않아** 재생·인증에 문제 없음.

## 범위 밖 (이후)

- 오프라인 **영상** 시청(라이브라 불가), **푸시 알림**(별도 복잡도), **네이티브 빌드**(Mac 필요 → Capacitor 재활용).
- 스트림 서명 URL 접근제한 = **Phase 6**(이번 앱화 이후 진행).

## 위험 / 주의

- **서비스워커 캐시 함정**: 동적(영상·인증·설정)을 캐시하면 재생 실패·옛 로그인 상태 등 유발 → **명시적 제외 필수**(설계에 반영). 배포 시 **캐시 버전 bump**로 옛 자산 잔존 방지.
- **브랜드 폰트 노출**: 웹 서버에 폰트 파일이 공개됨(자체 앱이라 사용은 정당하나 인지). 용량 크면 **필요한 2~3굵기만** 임베드.
- **iOS PWA 한계**: 매니페스트 부분 지원 → apple- 메타 태그가 실제 전체화면·아이콘의 핵심. 스플래시는 기본(아이콘+배경색)으로 충분.
- **온에어 색 변경**(녹색→레드): "온에어=라이브=레드" 방송 관습에 맞춤. 혼동 없게 오프에어는 뉴트럴 그레이.

## 결정 근거 요약

- **PWA 우선**: Mac 없이 아이폰에 "앱" 경험을 무료·즉시 제공하는 유일한 길. 네이티브로 가도 재활용됨.
- **라이트 테마 + 브랜드**: 사용자 요청(일반 테마·브랜드 컬러). 방송사 앱다운 정체성 확보.
- **앱 셸만 캐시**: 라이브 스트리밍 앱은 오프라인 영상이 불가하므로, SW는 로딩 속도·설치성만 담당하고 실시간 데이터는 건드리지 않는다.
