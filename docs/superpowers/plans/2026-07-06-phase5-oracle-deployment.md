# Phase 5 — 공개 배포(Oracle Cloud) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로컬에서 완성한 앱(MediaMTX + Caddy same-origin + Supabase + 순수 HTML/JS)을 Oracle Ubuntu 서버에 올려 `https://<이름>.duckdns.org`로 어디서든 로그인·시청 가능하게 한다.

**Architecture:** repo에 프로덕션용 설정 3종(Caddyfile.prod, mediamtx.prod.yml, mediamtx.service)과 SSH 배포 런북(README-phase5.md)을 추가한다. 프론트 코드는 무변경 — `buildHlsUrl`이 `location.protocol//location.host` 기반이라 도메인만 바뀌면 same-origin HTTPS로 그대로 동작한다. 서버에서는 "설정 배치 + 서비스 등록"만 수행한다.

**Tech Stack:** Oracle Cloud Always Free ARM(Ampere)/Ubuntu, MediaMTX(arm64), Caddy(apt, 자동 HTTPS), DuckDNS, systemd, Supabase(클라우드 그대로).

## Global Constraints

- **비밀값 커밋 금지**: publish 비밀번호·Supabase 키·인증서/키(`*.crt`, `*.key`)는 서버에만 둔다. repo 설정 파일에는 자리표시자(`CHANGE_ME_*`, `YOUR-NAME`)만 넣는다.
- **same-origin 유지**: 프로덕션도 로컬과 동일하게 Caddy가 `/live/*`만 MediaMTX(:8888)로 프록시하고 나머지는 정적 서빙한다. 프론트 코드/`config.js`의 HLS 경로 로직은 건드리지 않는다.
- **HLS 경로 규칙**: 채널 `path`는 `live/<키>`(예: `live/tv1`). 브라우저 재생 URL은 `https://<도메인>/<path>/index.m3u8`. OBS push는 `rtmp://<도메인>/live` + 스트림 키 `<키>`.
- **포트**: RTMP `1935`, HLS(내부) `8888`, MediaMTX API(내부) `9997`, 웹 `80`/`443`. 외부 개방은 `80, 443, 1935`만. `8888`/`9997`은 외부 비개방(프록시/로컬 전용).
- **프론트 무변경**: `frontend/` 아래 코드는 이 Phase에서 수정하지 않는다.

---

## File Structure

```
deploy/
  mediamtx.prod.yml     # RTMP publish 인증(authInternalUsers) + HLS(alwaysRemux). 익명은 read만.
  Caddyfile.prod        # 도메인 기반 자동 HTTPS + 정적 서빙 + /live 프록시
  mediamtx.service      # systemd 유닛(부팅 자동 시작·실패 재시작)
README-phase5.md        # SSH 단계별 배포·검증 런북(사용자가 서버에서 실행)
```

로컬 검증 도구: `bin\caddy.exe`(Caddyfile 문법 검증), `bin\mediamtx.exe`(설정 파싱 확인). 둘 다 gitignore된 로컬 바이너리.

---

### Task 1: MediaMTX 프로덕션 설정 (publish 인증)

로컬 `mediamtx.yml`을 기반으로, **익명은 HLS read만 / 지정 계정만 publish** 하도록 `authInternalUsers`를 추가한 프로덕션 설정을 만든다.

**Files:**
- Create: `deploy/mediamtx.prod.yml`

**Interfaces:**
- Produces: 채널 push는 사용자 `publisher`(비밀번호 자리표시자 `CHANGE_ME_STRONG_PASSWORD`)만 허용. 익명(`any`)은 `read`(HLS 재생)만. Task 3(systemd)이 이 파일을 `/opt/mediamtx/mediamtx.yml`로 실행하고, Task 4(런북)가 비밀번호 교체·OBS 설정을 참조한다.

- [ ] **Step 1: `deploy/mediamtx.prod.yml` 생성**

```yaml
###############################################
# Phase 5 — 프로덕션 MediaMTX 설정 (Oracle Ubuntu)
# RTMP 수신(publish 인증) → HLS 변환(익명 읽기 허용).
# 로컬 mediamtx.yml과 동일하나 authInternalUsers로 인제스트를 보호한다.
###############################################

logLevel: info

# --- 인증: 익명은 읽기만, publisher 계정만 push ---
# 서버에서 CHANGE_ME_STRONG_PASSWORD 를 실제 강한 비밀번호로 교체할 것(커밋 금지).
authInternalUsers:
  - user: any
    ips: []
    permissions:
      - action: read        # HLS 재생(익명 시청자)
  - user: publisher
    pass: CHANGE_ME_STRONG_PASSWORD
    ips: []
    permissions:
      - action: publish     # OBS가 RTMP로 스트림 push

# --- RTMP 수신 (OBS가 여기로 push, 인증 필요) ---
rtmp: true
rtmpAddress: :1935

# --- HLS 출력 (Caddy가 /live/* 를 여기로 프록시) ---
hls: true
hlsAddress: :8888
# same-origin(프록시 뒤)라 CORS는 사실상 불필요하지만 로컬과 동일하게 둔다.
hlsAllowOrigin: '*'
# push 중이면 시청자 없어도 HLS 상시 생성 → 온에어 probe/재생 콜드스타트 없음.
hlsAlwaysRemux: true
hlsVariant: mpegts

# --- API (로컬 상태 확인용, 외부 비개방) ---
api: true
apiAddress: 127.0.0.1:9997

# --- 경로: 정의되지 않은 모든 스트림 키 허용 ---
paths:
  all_others:
```

- [ ] **Step 2: 설정이 파싱되는지 로컬에서 확인**

로컬 MediaMTX/Caddy가 실행 중이면 먼저 종료(포트 충돌 방지):

```powershell
Get-Process mediamtx -ErrorAction SilentlyContinue | Stop-Process -Force
```

프로덕션 설정으로 잠깐 기동 후 로그 확인:

```powershell
Start-Process -FilePath ".\bin\mediamtx.exe" -ArgumentList ".\deploy\mediamtx.prod.yml" -RedirectStandardError ".\mtx-test.log" -RedirectStandardOutput ".\mtx-test.out" -NoNewWindow -PassThru | Select-Object -ExpandProperty Id
Start-Sleep -Seconds 2
Get-Content .\mtx-test.out -ErrorAction SilentlyContinue; Get-Content .\mtx-test.log -ErrorAction SilentlyContinue
Get-Process mediamtx -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item .\mtx-test.log,.\mtx-test.out -ErrorAction SilentlyContinue
```

Expected: 로그에 `[RTMP] listener opened on :1935`, `[HLS] listener opened on :8888` 유사 라인이 보이고 **config 파싱 에러가 없다**. (`authInternalUsers` 오타 시 여기서 즉시 에러가 남.)

- [ ] **Step 3: 커밋**

```powershell
git add deploy/mediamtx.prod.yml
git commit -m @'
feat(phase5): MediaMTX prod config with publish auth

익명은 HLS read만, publisher 계정만 RTMP publish 허용(authInternalUsers).
비밀번호는 자리표시자 — 서버에서 실제 값으로 교체.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 2: Caddy 프로덕션 설정 (도메인 HTTPS + 프록시)

로컬 `Caddyfile`을 기반으로, `:8080` 대신 **DuckDNS 도메인**을 사이트 주소로 써서 Caddy가 자동 HTTPS를 발급하게 한다. `/live/*` 프록시와 정적 서빙 구조는 동일.

**Files:**
- Create: `deploy/Caddyfile.prod`

**Interfaces:**
- Consumes: MediaMTX HLS(:8888) — Task 1이 제공.
- Produces: 정적 루트 `/opt/mbc-app/frontend`(Task 4 런북이 repo를 여기로 clone). 사이트 주소 자리표시자 `YOUR-NAME.duckdns.org`를 서버에서 실제 값으로 교체.

- [ ] **Step 1: `deploy/Caddyfile.prod` 생성**

```
# Phase 5 — 프로덕션 Caddy 설정 (Oracle Ubuntu)
# 로컬 Caddyfile과 동일한 same-origin 구조를, 도메인+자동 HTTPS로 확장.
# 사이트 주소를 도메인으로 두면 Caddy가 Let's Encrypt 인증서를 자동 발급/갱신한다.
#
# 서버에서 할 일:
#   1) 아래 YOUR-NAME.duckdns.org 를 실제 DuckDNS 도메인으로 교체
#   2) 이메일은 인증서 만료 알림용(선택) — 원치 않으면 email 줄 삭제 가능

{
	# 인증서 관련 관리 이메일(선택). 원치 않으면 이 블록 전체 삭제 가능.
	email YOUR-EMAIL@example.com
}

YOUR-NAME.duckdns.org {
	# HLS 스트림: /live/* 요청을 MediaMTX(:8888)로 그대로 전달
	handle /live/* {
		reverse_proxy 127.0.0.1:8888
	}

	# 그 외 모든 경로: 정적 프론트엔드 파일(repo를 /opt/mbc-app 로 clone)
	handle {
		root * /opt/mbc-app/frontend
		file_server
	}
}
```

- [ ] **Step 2: Caddyfile 문법 검증(로컬)**

```powershell
.\bin\caddy.exe validate --config .\deploy\Caddyfile.prod --adapter caddyfile
```

Expected: `Valid configuration` 출력, exit 0. (문법 오류 시 해당 라인 지적.) — 도메인 미소유·인증서 미발급은 validate 단계에서 문제되지 않는다(문법만 검사).

- [ ] **Step 3: 커밋**

```powershell
git add deploy/Caddyfile.prod
git commit -m @'
feat(phase5): Caddy prod config (domain HTTPS + /live proxy)

로컬 same-origin 구조를 DuckDNS 도메인 + 자동 HTTPS로 확장.
도메인/이메일은 자리표시자 — 서버에서 실제 값으로 교체.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 3: MediaMTX systemd 유닛

MediaMTX를 부팅 시 자동 시작하고 실패 시 재시작하는 systemd 서비스 유닛을 만든다. (Caddy는 apt 설치 시 자체 서비스가 등록되므로 유닛 불필요.)

**Files:**
- Create: `deploy/mediamtx.service`

**Interfaces:**
- Consumes: Task 1의 설정을 `/opt/mediamtx/mediamtx.yml`에서 읽고, 바이너리는 `/opt/mediamtx/mediamtx`로 가정(Task 4 런북이 이 경로에 배치).
- Produces: 서비스명 `mediamtx` — 런북이 `systemctl enable --now mediamtx`로 사용.

- [ ] **Step 1: `deploy/mediamtx.service` 생성**

```ini
[Unit]
Description=MediaMTX RTMP/HLS media server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
# 비특권 사용자로 실행(포트 1935/8888/9997 모두 >1024라 root 불필요).
User=mediamtx
Group=mediamtx
ExecStart=/opt/mediamtx/mediamtx /opt/mediamtx/mediamtx.yml
Restart=on-failure
RestartSec=5
# 안전 강화(선택)
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: 커밋**

```powershell
git add deploy/mediamtx.service
git commit -m @'
feat(phase5): systemd unit for MediaMTX

부팅 자동 시작 + 실패 재시작. 비특권 mediamtx 사용자로 실행.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 4: 배포 런북 (README-phase5.md)

SSH로 서버에서 그대로 붙여넣어 실행할 수 있는 단계별 배포·검증 가이드를 작성한다. 각 명령은 자리표시자를 실제 값으로 바꾸는 지점을 명시한다.

**Files:**
- Create: `README-phase5.md`

**Interfaces:**
- Consumes: Task 1~3의 파일(`deploy/*`)과 repo(GitHub `kminzy23/MBC_app_v2`).
- Produces: 사용자가 따라 실행하면 `https://<이름>.duckdns.org`가 동작하는 상태.

- [ ] **Step 1: `README-phase5.md` 생성**

````markdown
# Phase 5 — 공개 배포 런북 (Oracle Cloud + DuckDNS + Caddy HTTPS)

로컬에서 완성한 앱을 Oracle Ubuntu(ARM) 서버에 올려 어디서든 HTTPS로 접속·재생.
아래 명령은 **서버에 SSH 접속한 뒤** 순서대로 실행한다. `<...>` 자리표시자는 실제 값으로 교체.

준비물: Oracle Cloud 계정, DuckDNS 계정, 로컬에 검증된 repo.

---

## 1. Oracle 인스턴스 생성 (웹 콘솔)

1. Oracle Cloud 콘솔 → Compute → Instances → **Create instance**.
2. Image/shape: **Ubuntu 22.04(또는 24.04)**, **Ampere ARM (Always Free)** 선택.
   - ARM 용량 부족 에러가 나면 다른 가용 도메인(AD)/리전으로 재시도.
3. SSH 키: 로컬 공개키 업로드(없으면 콘솔에서 키쌍 생성 후 개인키 저장).
4. 생성 후 **Reserved public IP**로 고정 공인 IP 예약(선택이지만 권장 — 재부팅 시 IP 유지).
5. SSH 접속:
   ```bash
   ssh ubuntu@<서버공인IP>
   ```

## 2. 방화벽 개방 (2단계 — 둘 다 필요)

### 2-1. OCI 보안 목록 (웹 콘솔)
VCN → Security Lists → 기본 목록 → **Ingress Rules 추가**:
- TCP **80** (0.0.0.0/0) — HTTP/ACME
- TCP **443** (0.0.0.0/0) — HTTPS
- TCP **1935** (0.0.0.0/0) — RTMP push

### 2-2. Ubuntu 내부 방화벽
Oracle Ubuntu 이미지는 iptables에 기본 차단 규칙이 있다. 열어준다:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 1935 -j ACCEPT
sudo netfilter-persistent save
```
(ufw를 쓰는 이미지라면 `sudo ufw allow 80,443,1935/tcp` 로 대체.)

## 3. DuckDNS 도메인 연결

1. https://www.duckdns.org 로그인 → 서브도메인 생성(예: `mymbc`).
2. current ip 칸에 **서버 공인 IP** 입력 → update.
3. 확인:
   ```bash
   dig +short mymbc.duckdns.org   # 서버 IP가 나와야 함
   ```
   → 이후 도메인은 `mymbc.duckdns.org` 형태로 사용.

## 4. MediaMTX 설치 + 서비스 등록

```bash
# 4-1. 전용 사용자 + 디렉터리
sudo useradd --system --no-create-home --shell /usr/sbin/nologin mediamtx || true
sudo mkdir -p /opt/mediamtx

# 4-2. arm64 바이너리 다운로드(최신 릴리스 버전으로 URL 교체 가능)
#      https://github.com/bluenviron/mediamtx/releases 에서 linux_arm64v8 최신본 확인.
cd /tmp
curl -L -o mediamtx.tar.gz https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_arm64v8.tar.gz
tar xzf mediamtx.tar.gz
sudo mv mediamtx /opt/mediamtx/mediamtx
sudo chmod +x /opt/mediamtx/mediamtx

# 4-3. repo clone (설정/프론트 모두 여기서 사용)
sudo git clone https://github.com/kminzy23/MBC_app_v2.git /opt/mbc-app

# 4-4. 프로덕션 설정 배치
sudo cp /opt/mbc-app/deploy/mediamtx.prod.yml /opt/mediamtx/mediamtx.yml

# 4-5. publish 비밀번호 교체 — 파일을 열어 CHANGE_ME_STRONG_PASSWORD 를 실제 강한 값으로.
sudo nano /opt/mediamtx/mediamtx.yml

# 4-6. 권한
sudo chown -R mediamtx:mediamtx /opt/mediamtx

# 4-7. systemd 유닛 등록
sudo cp /opt/mbc-app/deploy/mediamtx.service /etc/systemd/system/mediamtx.service
sudo systemctl daemon-reload
sudo systemctl enable --now mediamtx
sudo systemctl status mediamtx --no-pager   # active(running) 확인
```

## 5. 앱 배포 (config.js 생성)

`frontend/js/config.js`는 gitignore라 clone에 없다. 서버에서 직접 생성:
```bash
sudo tee /opt/mbc-app/frontend/js/config.js >/dev/null <<'EOF'
window.SUPABASE_URL = 'https://<프로젝트REF>.supabase.co';
window.SUPABASE_ANON_KEY = '<anon-public-key>';
EOF
```
> 값은 로컬 `frontend/js/config.js`와 동일(Supabase 대시보드 → Settings → API).

Caddy(caddy 사용자)가 정적 파일을 읽을 수 있게 권한 부여:
```bash
sudo chmod -R a+rX /opt/mbc-app/frontend
```

## 6. Caddy 설치 + 도메인 설정

```bash
# 6-1. apt로 Caddy 설치(공식 저장소)
sudo apt update && sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# 6-2. 프로덕션 Caddyfile 배치 + 도메인/이메일 교체
sudo cp /opt/mbc-app/deploy/Caddyfile.prod /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # YOUR-NAME.duckdns.org, YOUR-EMAIL 교체

# 6-3. 적용(자동 HTTPS 발급)
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager
sudo journalctl -u caddy -n 30 --no-pager   # certificate obtained 로그 확인
```

## 7. Supabase 도메인 등록

Supabase 대시보드 → Authentication → URL Configuration:
- **Site URL**: `https://<이름>.duckdns.org`
- **Redirect URLs**에 `https://<이름>.duckdns.org/**` 추가(이메일 확인/재설정 흐름용).

## 8. OBS 송출 (인증)

OBS → 설정 → 방송:
- 서비스: 사용자 지정
- 서버: `rtmp://<이름>.duckdns.org/live`
- 스트림 키: `tv1?user=publisher&pass=<위에서-정한-비밀번호>`

→ 방송 시작하면 `https://<이름>.duckdns.org/live/tv1/index.m3u8`로 재생 가능.

## 9. 검증 (완료 기준)

- [ ] 브라우저에서 `https://<이름>.duckdns.org` → **자물쇠(유효 인증서)** 표시.
- [ ] 로그인 → player에 채널 카드 표시 → tv1 재생.
- [ ] **휴대폰 LTE/5G(WiFi 끄고)** 에서 접속·로그인·재생 성공.
- [ ] 인증 없는 RTMP push(`user/pass` 없이)는 **거부**된다(OBS "연결 실패").
- [ ] 서버 재부팅 후 `systemctl status mediamtx`,`caddy` 모두 자동 active.

## 문제 해결

- **인증서 발급 실패**: 80/443 방화벽(2단계 모두), DuckDNS IP가 서버 IP와 일치하는지 확인. `sudo journalctl -u caddy -f`로 ACME 로그 관찰.
- **재생 안 됨/오프에어**: `systemctl status mediamtx`, OBS가 실제 push 중인지, 스트림 키의 user/pass 확인. 서버에서 `curl -s http://127.0.0.1:8888/live/tv1/index.m3u8 | head`로 HLS 생성 확인.
- **403(정적 파일)**: `sudo chmod -R a+rX /opt/mbc-app/frontend` 재실행.
- **RTMP는 되는데 시청자만 실패**: `/live/*` 프록시(Caddyfile)와 `config.js` 존재 확인.

## 범위/다음
- 스트림 주소 자체 보호(서명 URL) → Phase 6. PWA → Phase 7. 운영 모니터링 → Phase 8.
````

- [ ] **Step 2: 커밋**

```powershell
git add README-phase5.md
git commit -m @'
docs(phase5): SSH deployment runbook

Oracle 인스턴스→방화벽→DuckDNS→MediaMTX(systemd)→앱→Caddy HTTPS→
Supabase 도메인→OBS 인증 송출→검증까지 단계별 명령.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 5: 푸시 + 프로젝트 상태 갱신

**Files:**
- Modify: `C:\Users\user\.claude\projects\C--Users-user-OneDrive-------mbc-test-MBC-app-v2\memory\project-status.md`

- [ ] **Step 1: GitHub push**

```powershell
git push origin main
```

Expected: `deploy/`(3파일) + `README-phase5.md`가 원격 main에 반영.

- [ ] **Step 2: 배포 실행은 사용자 몫임을 안내**

산출물(설정 3종 + 런북)이 repo에 있으므로, 실제 배포는 사용자가 `README-phase5.md`를 따라 서버에서 진행한다. 라이브 검증(9절 체크리스트)까지 끝나면 Phase 5 완료.

- [ ] **Step 3: project-status 메모리 갱신** (배포 산출물 완료 / 다음 재개 지점 = "서버에서 런북 실행 또는 Phase 6")

---

## Self-Review

**1. Spec coverage** (spec의 각 항목 → 태스크):
- 서버 Oracle ARM/Ubuntu → Task 4 §1 ✓
- DuckDNS → Task 4 §3 ✓
- Caddy 자동 HTTPS → Task 2 + Task 4 §6 ✓
- MediaMTX publish 인증(authInternalUsers) → Task 1 ✓ / OBS 자격증명 형식 → Task 4 §8 ✓
- 프론트 서빙 + /live 프록시(same-origin) → Task 2 ✓
- systemd 프로세스 관리 → Task 3 + Task 4 §4 ✓
- 산출물 `deploy/Caddyfile.prod, mediamtx.prod.yml, mediamtx.service, README-phase5.md` → Task 1~4 ✓
- 프론트 무변경(config.js는 서버 생성) → Task 4 §5, Global Constraints ✓
- Supabase Redirect/Site URL → Task 4 §7 ✓
- 포트 80/443/1935 개방(OCI + Ubuntu 방화벽) → Task 4 §2 ✓
- 완료 기준(LTE 재생, 무단 push 거부, 유효 인증서) → Task 4 §9 ✓

**2. Placeholder scan:** 코드/설정 자리표시자(`CHANGE_ME_*`, `YOUR-NAME`, `<...>`)는 의도된 "서버에서 교체" 지점이며 계획 자체의 미완성 placeholder가 아님. 모든 파일 내용은 완전히 기재됨.

**3. Type consistency:** 서비스명 `mediamtx`(Task 3 유닛 = Task 4 `systemctl`), 사용자 `publisher`/경로 `live/tv1`/포트 번호가 Task 1·2·4에서 일관. 정적 루트 `/opt/mbc-app/frontend`(Task 2 Caddyfile = Task 4 clone 경로) 일치. HLS 경로 `<host>/<path>/index.m3u8`가 `buildHlsUrl`(무변경) 및 프록시 규칙과 일치.
