# Phase 1 — 스트림을 흐르게 하기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OBS로 내보낸 RTMP 방송을 로컬 MediaMTX가 HLS로 변환해, PC와 같은 WiFi 휴대폰에서 재생되는 것을 증명한다.

**Architecture:** MediaMTX 바이너리를 Windows에서 직접 실행한다. OBS가 `rtmp://localhost:1935/live/<키>`로 push하면 MediaMTX가 `http://<주소>:8888/<키>/index.m3u8` HLS로 출력한다. 우리가 만드는 산출물은 `mediamtx.yml` 설정과 실행/검증 문서(`README-phase1.md`)다.

**Tech Stack:** MediaMTX (Windows amd64 바이너리), OBS Studio, VLC/브라우저, Windows PowerShell.

## Global Constraints

- 플랫폼: Windows 11, 셸은 PowerShell.
- 설치 방식: `mediamtx.exe` 바이너리 직접 실행 (Docker 미사용).
- Phase 1은 인증 없이 단순하게 — publish/read 인증은 Phase 5~6.
- RTMP 포트 1935는 localhost 전용 (외부 개방 금지). HLS 포트 8888만 같은 WiFi에 개방.
- 채널 키 규칙: TV = `tv1`, 라디오 = `radio1`.
- 검증 범위: PC(localhost) + 같은 WiFi 폰. 다른 네트워크는 범위 밖(Phase 5).
- 산출물 위치는 프로젝트 루트: `c:\Users\user\OneDrive\바탕 화면\mbc\test\MBC_app_v2`.

---

## File Structure

프로젝트 루트에 생성/수정되는 파일:

- `bin/mediamtx.exe` — 공식 바이너리 (다운로드본, git 제외)
- `bin/mediamtx.yml` — 바이너리에 동봉된 기본 설정 (참고용, 직접 수정 안 함)
- `mediamtx.yml` — **우리가 작성하는 설정** (RTMP 수신 + HLS 출력 + catch-all path)
- `README-phase1.md` — 실행 순서, OBS 설정값, 검증 방법, 방화벽 설정 정리
- `.gitignore` — (선택) `bin/` 제외

각 Task는 하나의 독립 검증 가능한 산출물로 끝난다. 이 Phase는 자동 유닛테스트 대상 코드가 없으므로, 각 Task의 "테스트"는 실제 서버 동작/스트림 재생을 육안 검증하는 것으로 대체한다.

---

### Task 0 (선택): git 저장소 초기화

> 현재 폴더는 git 저장소가 아니다. 커밋 단위로 진행하려면 먼저 초기화한다. git을 쓰지 않을 거면 이 Task와 이후 모든 "Commit" 스텝을 건너뛴다.

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: git 초기화**

Run:
```powershell
git init
```
Expected: `Initialized empty Git repository ...`

- [ ] **Step 2: .gitignore 작성**

Create `.gitignore`:
```gitignore
# MediaMTX 바이너리 (용량 큼 — 각자 다운로드)
/bin/

# OS
Thumbs.db
Desktop.ini
```

- [ ] **Step 3: 첫 커밋**

Run:
```powershell
git add .gitignore "방송 스트림 모니터링 앱_구현계획서.mc" docs
git commit -m "chore: init repo, add plan and specs"
```
Expected: 커밋 생성됨.

---

### Task 1: MediaMTX 바이너리 다운로드 및 기본 실행 확인

목표: 바이너리가 실행되고, 기본 설정으로 RTMP/HLS 서버가 뜨는지 확인한다.

**Files:**
- Create: `bin/mediamtx.exe`, `bin/mediamtx.yml` (압축 해제로 생성됨)

**Interfaces:**
- Produces: 실행 가능한 `bin\mediamtx.exe`. 실행 시 RTMP는 `:1935`, HLS는 `:8888`에서 대기(기본값).

- [ ] **Step 1: 최신 Windows 바이너리 다운로드**

Run (PowerShell, 프로젝트 루트에서):
```powershell
New-Item -ItemType Directory -Force bin | Out-Null
$asset = (Invoke-RestMethod https://api.github.com/repos/bluenviron/mediamtx/releases/latest).assets |
  Where-Object { $_.name -like "*windows_amd64.zip" } | Select-Object -First 1
Invoke-WebRequest $asset.browser_download_url -OutFile bin\mediamtx.zip
Expand-Archive bin\mediamtx.zip -DestinationPath bin -Force
Remove-Item bin\mediamtx.zip
Get-ChildItem bin
```
Expected: `bin` 폴더에 `mediamtx.exe`, `mediamtx.yml`, `LICENSE` 등이 보인다.

- [ ] **Step 2: 기본 설정으로 실행**

Run:
```powershell
.\bin\mediamtx.exe .\bin\mediamtx.yml
```
Expected 로그 (버전에 따라 문구 차이 가능):
```
INF MediaMTX v1.x.x
INF [RTMP] listener opened on :1935
INF [HLS] listener opened on :8888
```

- [ ] **Step 3: HLS 포트 응답 확인 (다른 PowerShell 창에서)**

Run:
```powershell
Invoke-WebRequest http://localhost:8888/ -UseBasicParsing | Select-Object StatusCode
```
Expected: `StatusCode 200` (또는 404 — 서버가 응답하면 성공. 연결 거부만 아니면 됨).

- [ ] **Step 4: 서버 정지**

실행 중인 창에서 `Ctrl+C`로 종료. (다음 Task에서 우리 설정으로 다시 실행)

---

### Task 2: mediamtx.yml 설정 작성 (RTMP 수신 + HLS 출력)

목표: 프로젝트 루트에 우리 설정 파일을 만들고, 이 설정으로 서버가 정상 기동하는지 확인한다.

**Files:**
- Create: `mediamtx.yml` (프로젝트 루트)

**Interfaces:**
- Consumes: Task 1의 `bin\mediamtx.exe`.
- Produces: 루트 `mediamtx.yml`. RTMP `:1935` 수신, HLS `:8888` 출력, 모든 경로(`all_others`) publish/read 허용.

- [ ] **Step 1: mediamtx.yml 작성**

Create `mediamtx.yml` (프로젝트 루트):
```yaml
###############################################
# Phase 1 — 로컬 테스트용 MediaMTX 설정
# RTMP 수신 → HLS 변환. 인증 없음(로컬 전용).
###############################################

logLevel: info

# --- RTMP 수신 (OBS가 여기로 push) ---
rtmp: yes
rtmpAddress: :1935

# --- HLS 출력 (뷰어가 여기서 재생) ---
hls: yes
hlsAddress: :8888
# 아무도 안 보고 있어도 계속 변환할지 여부. 테스트 편의상 필요할 때만 변환.
hlsAlwaysRemux: no
# 저지연 불필요 → 표준 HLS
hlsVariant: mpegts

# --- API (상태 확인용, 선택) ---
api: yes
apiAddress: :9997

# --- 경로 설정 ---
# all_others = 정의되지 않은 모든 경로. 임의의 스트림 키를 허용한다.
paths:
  all_others:
```

- [ ] **Step 2: 우리 설정으로 실행**

Run (프로젝트 루트에서):
```powershell
.\bin\mediamtx.exe .\mediamtx.yml
```
Expected 로그:
```
INF [RTMP] listener opened on :1935
INF [HLS] listener opened on :8888
INF [API] listener opened on :9997
```

- [ ] **Step 3: API로 서버 상태 확인 (다른 창에서)**

Run:
```powershell
Invoke-RestMethod http://localhost:9997/v3/paths/list
```
Expected: `itemCount : 0` 같은 JSON 응답 (아직 스트림 없음). 오류 없이 응답하면 설정 로드 성공.

- [ ] **Step 4: 커밋** (Task 0을 했을 때만)

Run:
```powershell
git add mediamtx.yml
git commit -m "feat(phase1): add mediamtx.yml (RTMP ingest + HLS output)"
```

> 서버는 다음 Task를 위해 계속 실행해 둔다.

---

### Task 3: OBS에서 TV 채널(tv1) push → PC에서 재생 확인

목표: OBS로 영상+음성을 RTMP push하고, PC에서 HLS로 재생되는 것을 확인한다.

**Files:** (없음 — 설정과 검증)

**Interfaces:**
- Consumes: 실행 중인 MediaMTX (Task 2).
- Produces: `tv1` 경로에서 재생 가능한 HLS: `http://localhost:8888/tv1/index.m3u8`.

- [ ] **Step 1: OBS 방송 설정**

OBS Studio → 설정(Settings) → 방송(Stream):
- 서비스(Service): **사용자 지정...(Custom...)**
- 서버(Server): `rtmp://localhost:1935/live`
- 스트림 키(Stream Key): `tv1`

"적용" → "확인".

- [ ] **Step 2: 소스 추가 후 방송 시작**

OBS 장면에 아무 소스(예: 디스플레이 캡처, 미디어 소스, 색상 소스)와 오디오를 추가한 뒤 **"방송 시작(Start Streaming)"** 클릭.

- [ ] **Step 3: MediaMTX가 스트림을 받았는지 확인**

MediaMTX 실행 창 로그 확인.
Expected:
```
INF [RTMP] [conn ...] opened
INF [path tv1] [RTMP source] ready: ...
```
또는 API로:
```powershell
Invoke-RestMethod http://localhost:9997/v3/paths/list
```
Expected: `tv1` 경로가 목록에 나타나고 `ready : True`.

- [ ] **Step 4: PC 브라우저/VLC에서 재생**

브라우저 주소창 또는 VLC(미디어 → 네트워크 스트림 열기)에 입력:
```
http://localhost:8888/tv1/index.m3u8
```
Expected: OBS 화면이 10~20초 지연으로 재생된다. (브라우저는 내장 HLS 지원 여부에 따라 다를 수 있으니 확실한 검증은 VLC 권장.)

**검증 성공 = Phase 1 절반 완료.**

---

### Task 4: 방화벽 개방 후 같은 WiFi 폰에서 재생 확인

목표: 같은 WiFi의 휴대폰 브라우저에서 재생되게 한다.

**Files:** (없음 — 방화벽 규칙 + 검증)

**Interfaces:**
- Consumes: 실행 중인 MediaMTX + push 중인 `tv1` (Task 3).
- Produces: 같은 LAN에서 접근 가능한 `http://<PC-IP>:8888/tv1/index.m3u8`.

- [ ] **Step 1: PC의 LAN IP 확인**

Run:
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" } | Select-Object IPAddress, InterfaceAlias
```
Expected: `192.168.x.x` 같은 주소가 나온다. 이 값을 `<PC-IP>`로 사용.

- [ ] **Step 2: 방화벽 inbound 8888 허용 (관리자 PowerShell 필요)**

관리자 권한 PowerShell에서:
```powershell
New-NetFirewallRule -DisplayName "MediaMTX HLS 8888" -Direction Inbound -Protocol TCP -LocalPort 8888 -Action Allow
```
Expected: 규칙이 생성된다. (1935는 열지 않는다.)

- [ ] **Step 3: 폰에서 재생**

폰을 PC와 **같은 WiFi**에 연결한 뒤, 폰 브라우저(iOS 사파리 권장 — HLS 네이티브 지원)에서:
```
http://<PC-IP>:8888/tv1/index.m3u8
```
Expected: 폰에서 OBS 화면이 재생된다.

> 안 되면 확인: (1) 폰이 같은 WiFi인지, (2) 방화벽 규칙이 실제로 추가됐는지(`Get-NetFirewallRule -DisplayName "MediaMTX HLS 8888"`), (3) PC-IP가 맞는지, (4) 라우터의 AP격리(Client Isolation)가 꺼져 있는지.

---

### Task 5: 라디오 채널(radio1) 오디오 전용 스트림 확인

목표: 영상 없이 오디오만 push해도 HLS로 재생되는지 확인한다.

**Files:** (없음 — 설정과 검증)

**Interfaces:**
- Consumes: 실행 중인 MediaMTX.
- Produces: 오디오 전용 HLS: `http://localhost:8888/radio1/index.m3u8`.

- [ ] **Step 1: OBS를 radio1로 재설정**

TV 방송을 중지(Stop Streaming)하고, 설정 → 방송 → 스트림 키를 `radio1`로 변경. 장면에서 영상 소스를 끄고 **오디오 소스만** 남긴다(마이크 또는 미디어 소스의 오디오).

> 대안: OBS 프로필/컬렉션을 따로 두면 tv1/radio1을 오갈 때 편하다. Phase 1에서는 스트림 키만 바꿔도 충분.

- [ ] **Step 2: 방송 시작 후 수신 확인**

"방송 시작" 후:
```powershell
Invoke-RestMethod http://localhost:9997/v3/paths/list
```
Expected: `radio1` 경로가 `ready : True`.

- [ ] **Step 3: 재생 확인**

VLC 또는 폰에서:
```
http://localhost:8888/radio1/index.m3u8
```
Expected: 오디오가 재생된다(영상 없음). VLC에서는 오디오 비주얼라이저/검은 화면 + 소리로 확인.

---

### Task 6: README-phase1.md 문서화

목표: 다음에 누구든(또는 미래의 나) 이 절차를 그대로 재현할 수 있게 정리한다.

**Files:**
- Create: `README-phase1.md` (프로젝트 루트)

**Interfaces:**
- Consumes: Task 1~5에서 확정된 실행/검증 절차.

- [ ] **Step 1: README-phase1.md 작성**

Create `README-phase1.md`:
```markdown
# Phase 1 — 로컬 스트림 실행/검증 가이드

## 1. MediaMTX 실행
프로젝트 루트에서:
    .\bin\mediamtx.exe .\mediamtx.yml
- RTMP 수신: :1935 (localhost 전용)
- HLS 출력: :8888
- API: :9997 (상태 확인)

## 2. OBS 설정
설정 → 방송(Stream):
- 서비스: 사용자 지정(Custom)
- 서버: rtmp://localhost:1935/live
- 스트림 키: tv1 (라디오는 radio1)

TV 채널: 영상+오디오 소스. 라디오 채널: 오디오 소스만.
"방송 시작"을 누르면 push 시작.

## 3. 재생 (검증)
- PC:  http://localhost:8888/tv1/index.m3u8   (VLC 권장)
- 폰(같은 WiFi): http://<PC-IP>:8888/tv1/index.m3u8
- 라디오: .../radio1/index.m3u8

<PC-IP> 확인:
    Get-NetIPAddress -AddressFamily IPv4 | ? { $_.IPAddress -like "192.168.*" }

## 4. 폰 접속용 방화벽 (관리자 PowerShell, 최초 1회)
    New-NetFirewallRule -DisplayName "MediaMTX HLS 8888" -Direction Inbound -Protocol TCP -LocalPort 8888 -Action Allow

## 5. 상태 확인
    Invoke-RestMethod http://localhost:9997/v3/paths/list

## 문제 해결
- 폰에서 안 보임: 같은 WiFi인지 / 방화벽 규칙 / PC-IP / 라우터 AP격리(Client Isolation) 확인.
- 다른 네트워크(LTE, 다른 WiFi)에서는 로컬에서 불가 — Phase 5(공개 배포)에서 해결.

## 다음 단계
Phase 2 — hls.js 웹 플레이어. 이 HLS 주소들을 브라우저 플레이어에 연결한다.
```

- [ ] **Step 2: 커밋** (Task 0을 했을 때만)

Run:
```powershell
git add README-phase1.md
git commit -m "docs(phase1): add local stream run/verify guide"
```

---

## 완료 기준 (Phase 1 전체)

- [ ] PC에서 `tv1` HLS가 VLC/브라우저로 재생됨
- [ ] 같은 WiFi 폰에서 `tv1` HLS가 재생됨
- [ ] `radio1` 오디오 전용 스트림이 재생됨
- [ ] `mediamtx.yml`, `README-phase1.md`가 저장됨

이 4개가 충족되면 Phase 2(웹 플레이어)로 진행한다.
