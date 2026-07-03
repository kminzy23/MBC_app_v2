# Phase 1 — 로컬 스트림 실행/검증 가이드

OBS로 내보낸 RTMP 방송을 로컬 MediaMTX가 HLS로 변환해, PC와 같은 WiFi 휴대폰에서
재생하는 단계. (다른 네트워크에서의 시청/인제스트는 Phase 5에서 다룸)

---

## 구성 요약

```
OBS(같은 PC) ──RTMP:1935──▶ MediaMTX ──HLS:8888──▶ VLC / 브라우저 / 같은 WiFi 폰
rtmp://localhost:1935/live   [bin\mediamtx.exe]   http://<주소>:8888/live/<키>/index.m3u8
       + 키: tv1
```

> **중요:** OBS와 MediaMTX는 **같은 PC**에서 실행한다. 방송 PC와 개발 PC가 서로 다른
> 네트워크(망)면 사설 IP가 NAT에 막혀 push가 안 된다. 이는 Phase 1의 범위 밖이며,
> 인터넷을 통한 인제스트/시청은 Phase 5(공개 배포)에서 해결한다.

---

## 1. MediaMTX 실행

프로젝트 루트에서:

```powershell
.\bin\mediamtx.exe .\mediamtx.yml
```

- RTMP 수신: `:1935` (localhost 전용)
- HLS 출력: `:8888`
- API(상태 확인): `:9997`

`bin\mediamtx.exe`는 공식 릴리스 바이너리(현재 v1.19.2). 설정은 루트의 `mediamtx.yml`.

---

## 2. OBS 설정

**설정(Settings) → 방송(Stream):**

| 항목 | 값 |
|------|-----|
| 서비스(Service) | 사용자 지정...(Custom...) |
| 서버(Server) | `rtmp://localhost:1935/live` |
| 스트림 키(Stream Key) | `tv1` (라디오는 `radio1`) |

- TV 채널: 영상 + 오디오 소스.
- 라디오 채널: 오디오 소스만 (영상 없이).
- 소스 추가 후 **방송 시작(Start Streaming)**.

> 서버가 `.../live`이고 키가 `tv1`이므로 MediaMTX 내부 경로는 **`live/tv1`**이 된다.
> 재생 주소도 `/live/tv1/`을 쓴다.

---

## 3. 재생 (검증)

| 위치 | 주소 |
|------|------|
| PC | `http://localhost:8888/live/tv1/index.m3u8` |
| 같은 WiFi 폰 | `http://<PC-IP>:8888/live/tv1/index.m3u8` |
| 라디오 | `.../live/radio1/index.m3u8` |

- **VLC 권장:** 미디어 → 네트워크 스트림 열기(Ctrl+N) → 주소 붙여넣기 → 재생.
- 브라우저는 내장 HLS 지원 여부에 따라 안 될 수 있음. (Phase 2에서 hls.js 웹 플레이어로 해결)
- 저지연 불필요 설정이라 10~20초 지연은 정상.

### `<PC-IP>` 확인 (WiFi를 바꾸면 IP도 바뀜)

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  ($_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*") -and $_.AddressState -eq "Preferred"
} | Select-Object IPAddress, InterfaceAlias
```

---

## 4. 폰 접속용 방화벽 (관리자 PowerShell, 최초 1회)

폰에서 8888 포트로 들어오려면 Windows 방화벽 인바운드 허용이 필요하다.

1. 시작 메뉴 → PowerShell 우클릭 → **관리자 권한으로 실행** → UAC "예"
2. 실행:

```powershell
New-NetFirewallRule -DisplayName "MediaMTX HLS 8888" -Direction Inbound -Protocol TCP -LocalPort 8888 -Action Allow
```

- 1935(RTMP)는 localhost 전용이므로 외부로 열지 않는다.
- 규칙 확인: `Get-NetFirewallRule -DisplayName "MediaMTX HLS 8888"`

---

## 5. 상태 확인 (API)

```powershell
Invoke-RestMethod http://localhost:9997/v3/paths/list
```

- `itemCount`가 1 이상이고 해당 경로의 `ready`가 `True`면 스트림 수신 중.
- 예: `path: live/tv1 | ready: True | source: rtmpConn | tracks: H264,MPEG-4 Audio`

---

## 문제 해결

| 증상 | 확인 |
|------|------|
| OBS "서버에 연결하지 못했습니다" | OBS와 MediaMTX가 **같은 PC**인지 / 서버 주소가 `rtmp://localhost:1935/live`인지 / MediaMTX 실행 중인지 |
| 폰에서 안 보임 | 폰이 **같은 WiFi**인지 / 방화벽 8888 규칙 / `<PC-IP>`가 현재 값인지(WiFi 변경 시 IP 변경) / 라우터 AP격리(Client Isolation) |
| 첫 재생이 느림/타임아웃 | HLS는 첫 접속 시 변환 시작(on-demand). 몇 초 후 재시도 |
| 다른 WiFi/LTE에서 시청 불가 | 정상. 로컬 단계에선 불가하며 Phase 5(공개 배포)에서 해결 |

---

## Phase 1 완료 현황

- [x] PC에서 `live/tv1` HLS 재생 확인
- [x] 같은 WiFi 폰에서 `live/tv1` HLS 재생 확인
- [ ] `radio1` 오디오 전용 스트림 재생 확인 — **보류(추후 진행)**
- [x] `mediamtx.yml`, `README-phase1.md` 저장

---

## 다음 단계

**Phase 2 — hls.js 웹 플레이어.** 위 HLS 주소들을 브라우저 플레이어에 연결하고,
채널 목록 UI에서 골라 재생하도록 만든다. (라디오 검증은 Phase 2 전 또는 병행하여 진행)
