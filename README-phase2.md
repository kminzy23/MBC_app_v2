# Phase 2 — 웹 플레이어 실행/검증 가이드

로그인 없는 웹 플레이어. 채널 목록에서 골라 HLS로 재생한다.
PC·같은 WiFi 폰(iPhone 사파리 포함)에서 동작 확인 완료.

---

## 구성 (same-origin)

```
             ┌───────────── Caddy :8080 ─────────────┐
브라우저 ──▶ │ /            → frontend/ 정적 파일       │
(폰/PC)      │ /live/*      → reverse_proxy :8888 ─────┼─▶ MediaMTX ◀── OBS(RTMP)
             └───────────────────────────────────────┘
```

**핵심**: 페이지와 스트림을 **같은 출처(:8080)**로 합쳤다. Caddy가 `/live/*`만 MediaMTX(:8888)로
프록시한다. 이렇게 하면 교차 출처(CORS)·쿠키 문제가 없어 iOS 사파리에서도 재생·상태확인이 된다.
(Phase 5에서 이 Caddy 구성을 HTTPS·도메인으로 그대로 확장한다.)

---

## 실행 순서

1. **MediaMTX** (Phase 1) + OBS로 `live/tv1` push
   ```powershell
   .\bin\mediamtx.exe .\mediamtx.yml
   ```
2. **Caddy** (프론트 서빙 + /live 프록시)
   ```powershell
   .\bin\caddy.exe run --config Caddyfile --adapter caddyfile
   ```
3. **접속**
   - PC:  `http://localhost:8080/player.html`
   - 폰(같은 WiFi): `http://<PC-IP>:8080/player.html`
     - `<PC-IP>` 확인: `Get-NetIPAddress -AddressFamily IPv4 | ? { $_.IPAddress -like "192.168.*" }`
     - 캐시 우회가 필요하면 `?v=2` 등을 붙인다.

방화벽: 폰 접속용 **inbound 8080** 허용 1회 필요(관리자 PowerShell).
```powershell
New-NetFirewallRule -DisplayName "WebPlayer 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```
> 이제 폰은 8080만 사용한다. 8888은 프록시 뒤로 숨었으므로 외부에 열 필요 없다.

---

## 파일

```
frontend/
  player.html        # 채널 목록 + 플레이어
  js/urls.js         # buildHlsUrl (same-origin URL 조립)
  js/channels.js     # 채널 목록 (하드코딩)
  js/player.js       # 렌더·재생·상태·에러
  js/hls.min.js      # hls.js (로컬)
  css/style.css      # 반응형 스타일
Caddyfile            # :8080 정적 + /live 프록시
test/urls.test.js    # buildHlsUrl 유닛 테스트 (node)
```

채널 추가: `js/channels.js`의 `CHANNELS` 배열에
`{ id, name, type:'tv'|'radio', path:'live/<키>' }`를 넣으면 된다.

---

## 진행하며 확정된 설계 결정 (계획 대비 변경점)

1. **same-origin + Caddy 리버스 프록시** (원래 python http.server + :8888 직접 접근)
   - 이유: iOS 사파리는 페이지(:8080)와 스트림(:8888)이 다른 출처면 `fetch`·hls.js의
     교차 출처 요청 + MediaMTX `?cookieCheck` 쿠키 리다이렉트를 막아 재생·상태확인이 실패한다.
     같은 출처로 합쳐 근본 해결. (`buildHlsUrl`도 :8888 대신 `location.host` 사용)

2. **hls.js 분기를 우선** (`Hls.isSupported()` 먼저, 네이티브는 폴백)
   - 이유: 데스크톱 크롬은 `canPlayType('application/vnd.apple.mpegurl')`가 `'maybe'`를
     반환하지만 실제로 HLS를 디먹스하지 못한다(`DEMUXER_ERROR`). 네이티브를 먼저 쓰면 크롬에서 실패.

3. **`hlsAlwaysRemux: true`** (원래 false)
   - 이유: false면 on-demand로 뮤서가 첫 요청 때 초기화되어, 상태확인 probe가 콜드 상태에서
     404를 받아 "오프에어"로 오판한다. push 중인 채널을 상시 remux해 즉시 "온에어"·즉시 재생.

4. **hls.js fatal 에러 복구**: 네트워크/미디어 오류 시 즉시 실패로 처리하지 않고
   `startLoad()`/`recoverMediaError()`로 최대 3회 재시도 후에만 "재생 불가" 표시.

---

## 검증 완료 (Phase 2)

- [x] 채널 카드 목록 렌더 (TV1/TV2/라디오1)
- [x] TV1 실시간 재생 (PC: currentTime 진행 확인, 1280x720)
- [x] 온에어/오프에어 뱃지 (tv1 온에어, 없는 채널 오프에어)
- [x] 라디오 타입 오디오 전용 UI 분기 (🎵 오버레이 토글)
- [x] 반응형 레이아웃
- [x] **폰(iPhone 사파리)에서 재생**
- [x] `node test/urls.test.js` 통과
- [ ] 라디오 실제 스트림 재생 — 보류(Phase 1 라디오 검증과 함께 추후)

---

## 다음 단계

**Phase 3 — Supabase 로그인.** 로그인한 사용자만 player에 접근하도록 한다.
`index.html`(로그인) + `js/auth.js`를 추가하고, 미로그인 시 리다이렉트.
