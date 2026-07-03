# Phase 2 설계 — 웹 플레이어 (로컬, 로그인 없음)

> 방송 스트림 모니터링 앱의 두 번째 단계. 브라우저에서 채널 목록을 보고 골라 HLS로 재생한다.
> 상위 계획: `방송 스트림 모니터링 앱_구현계획서.mc` / 선행: Phase 1 (로컬 HLS 스트림)

## 목표

브라우저(특히 모바일)에서 채널 목록을 보고 채널을 골라 HLS로 재생하는 깔끔한 웹 페이지를
만든다. 로그인은 아직 없다(Phase 3). Phase 1에서 검증한 `live/tv1` 스트림을 실제로 재생한다.

## 확정 사항

| 항목 | 결정 |
|------|------|
| 기술 | 순수 HTML/JS + hls.js (빌드 도구 없음) |
| 로컬 서빙 | Python 내장 서버 `python -m http.server 8080 --directory frontend` |
| 디자인 | 깔끔한 반응형 모바일 UI (상단 플레이어 + 채널 카드 목록) |
| 채널 목록 | channels.js에 하드코딩 (tv1 실제 + radio1/tv2 등 예시). Phase 4에서 DB화 |
| 로그인 | 범위 밖 (Phase 3) |

## 파일 구조

```
/frontend
  player.html         # 채널 목록 + 플레이어 (Phase 2 메인 화면)
  /js
    channels.js       # 채널 목록 데이터 (하드코딩)
    player.js         # hls.js 초기화·재생, iOS 분기, 상태/에러 처리
    hls.min.js        # hls.js 라이브러리 (로컬 파일, 다운로드본)
  /css
    style.css         # 반응형 모바일 스타일
```

> hls.js는 CDN이 아니라 **로컬 파일**(`js/hls.min.js`)로 둔다. 인터넷 없이도 동작하고
> Phase 7 PWA 오프라인 셸에도 자연스럽게 포함된다.

`index.html`(로그인), `js/auth.js`, `manifest.json`, `service-worker.js`는 각각 Phase 3/7에서 추가한다.

각 파일의 책임:
- **channels.js**: 채널 데이터만. UI·재생 로직 없음.
- **player.js**: 재생·상태·에러 로직. 채널 데이터는 channels.js에서 가져온다.
- **player.html**: 마크업과 컨테이너. 로직은 player.js가 담당.
- **style.css**: 스타일만.

## 컴포넌트 & 데이터 흐름

### channels.js
채널 배열을 전역 또는 모듈로 내보낸다. 각 채널 객체:

```js
{ id: 'tv1', name: 'TV1', type: 'tv', path: 'live/tv1' }
```

- `id`: 고유 식별자
- `name`: 표시 이름
- `type`: `'tv'` | `'radio'` (라디오는 오디오 전용 UI로 분기)
- `path`: MediaMTX 경로 (`live/tv1`). HLS URL 조립에 사용.

초기 목록: tv1(실제 온에어), radio1·tv2 등 예시(오프에어로 표시될 것).

### player.html
- 상단: `<video>` 기반 플레이어 영역
- 하단: 채널 카드 목록. 카드에 이름·타입·상태(온에어/오프에어) 뱃지
- 카드 클릭 → 해당 채널 재생

### player.js
- **HLS URL 조립**: `` `${location.protocol}//${location.hostname}:8888/${channel.path}/index.m3u8` ``
  - `location.hostname`을 쓰므로 PC(localhost)·폰(<PC-IP>) 접속에서 모두 올바른 호스트를 가리킨다.
- **재생 분기**:
  - iOS 사파리 등 HLS 네이티브 지원 브라우저: `<video>.src`에 URL 직접 지정
  - 그 외(안드로이드 크롬 등): hls.js로 로드
  - 판정: `video.canPlayType('application/vnd.apple.mpegurl')` 우선, 아니면 `Hls.isSupported()`
- **채널 상태 확인**: 목록 렌더 시 각 채널의 `index.m3u8`을 fetch(GET) → 200이면 "온에어",
  실패(404 등)면 "오프에어" 뱃지. (MediaMTX는 없는 경로엔 404를 빠르게 반환)
- **라디오 분기**: `type === 'radio'`면 오디오 전용 UI(아트워크/플레이스홀더 영역 + 오디오 컨트롤).

## 에러/상태 처리

- 재생 오류(스트림 끊김·404·미지원): 사용자에게 에러 메시지 노출, 카드 상태를 "오프에어/재생 불가"로.
- 로딩 중: 스피너/로딩 표시.
- hls.js 네트워크 에러(`Hls.Events.ERROR`, `fatal`): 제한된 횟수만큼 자동 재시도 후 실패 시 에러 표시.

## CORS

페이지는 `:8080`, 스트림은 `:8888`로 출처가 다르다. MediaMTX HLS는 기본값
`hlsAllowOrigin: '*'`로 교차 출처 재생을 허용한다. `mediamtx.yml`에 명시해 확실히 한다.

## 로컬 실행 & 검증

```powershell
# 1) MediaMTX 실행 (Phase 1) + OBS로 live/tv1 push
.\bin\mediamtx.exe .\mediamtx.yml
# 2) 프론트 서빙
python -m http.server 8080 --directory frontend
# 3) 접속
#   PC:  http://localhost:8080/player.html
#   폰:  http://<PC-IP>:8080/player.html   (방화벽 8080 개방 필요)
```

### 완료 기준
- 폰 브라우저에서 채널을 골라 재생할 수 있다.
- 온에어인 `tv1`은 재생되고, 존재하지 않는 예시 채널은 "오프에어"로 표시된다.
- 모바일 화면에서 레이아웃이 깨지지 않는다(반응형).

## 범위 밖 (이후 Phase)

- 로그인/접근 차단 (Phase 3)
- 채널 DB화·썸네일 (Phase 4)
- 서명 URL 접근제한 (Phase 6)
- PWA (Phase 7)

## 결정 근거 요약

- **순수 HTML/JS**: 화면이 적고 1인 개발·무료 배포·PWA 확장에 유리. React의 이점(대규모
  상태/컴포넌트)이 발휘될 규모가 아니므로 YAGNI로 단순하게 간다. Phase 5(Caddy 정적 서빙)와도 일치.
- **Python http.server**: 설치 불필요(Python 3.12 존재), 정적 서빙에 충분. Caddy는 Phase 5에서 도입.
- **location.hostname 기반 URL**: PC·폰 접속을 코드 수정 없이 동시 지원.
