# Phase 5 — 공개 배포 런북 (Oracle Cloud + DuckDNS + Caddy HTTPS)

로컬에서 완성한 앱을 Oracle Ubuntu(ARM) 서버에 올려 어디서든 HTTPS로 접속·재생.
아래 명령은 **서버에 SSH 접속한 뒤** 순서대로 실행한다. `<...>`·`YOUR-...` 자리표시자는 실제 값으로 교체.

준비물: Oracle Cloud 계정, DuckDNS 계정, 로컬에 검증된 repo(`kminzy23/MBC_app_v2`).

산출물(repo `deploy/`):
- `deploy/mediamtx.prod.yml` — publish 인증 MediaMTX 설정
- `deploy/Caddyfile.prod` — 도메인 HTTPS + `/live` 프록시
- `deploy/mediamtx.service` — systemd 유닛

---

## 1. Oracle 인스턴스 생성 (웹 콘솔)

1. Oracle Cloud 콘솔 → Compute → Instances → **Create instance**.
2. Image/shape: **Ubuntu 22.04(또는 24.04)**, **Ampere ARM (Always Free)** 선택.
   - ARM 용량 부족 에러가 나면 다른 가용 도메인(AD)/리전으로 재시도.
3. SSH 키: 로컬 공개키 업로드(없으면 콘솔에서 키쌍 생성 후 개인키 저장).
4. 생성 후 **Reserved public IP**로 고정 공인 IP 예약(권장 — 재부팅 시 IP 유지).
5. SSH 접속:
   ```bash
   ssh ubuntu@<서버공인IP>
   ```

## 2. 방화벽 개방 (2단계 — 둘 다 필요)

Oracle은 클라우드 방화벽(보안 목록)과 인스턴스 내부 방화벽(iptables)이 **모두** 막혀 있다. 둘 다 열어야 한다.

### 2-1. OCI 보안 목록 (웹 콘솔)
VCN → Security Lists → 기본 목록 → **Ingress Rules 추가** (Source `0.0.0.0/0`, TCP):
- **80** — HTTP/ACME(인증서 발급)
- **443** — HTTPS
- **1935** — RTMP push

### 2-2. Ubuntu 내부 방화벽
Oracle Ubuntu 이미지는 iptables에 기본 차단 규칙이 있다. 열어준다:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 1935 -j ACCEPT
sudo netfilter-persistent save
```
(ufw를 쓰는 이미지라면 대신 `sudo ufw allow 80,443,1935/tcp`.)

> 8888(HLS)·9997(API)은 **열지 않는다** — Caddy 프록시/로컬 전용.

## 3. DuckDNS 도메인 연결

1. https://www.duckdns.org 로그인 → 서브도메인 생성(예: `mymbc`).
2. current ip 칸에 **서버 공인 IP** 입력 → update.
3. 확인(로컬 또는 서버에서):
   ```bash
   dig +short mymbc.duckdns.org   # 서버 공인 IP가 나와야 함
   ```
   → 이후 도메인은 `mymbc.duckdns.org` 형태로 사용.

## 4. MediaMTX 설치 + 서비스 등록

```bash
# 4-1. 전용 사용자 + 디렉터리
sudo useradd --system --no-create-home --shell /usr/sbin/nologin mediamtx || true
sudo mkdir -p /opt/mediamtx

# 4-2. 바이너리 다운로드 — CPU 아키텍처에 맞는 에셋 선택
#   AMD/Intel 인스턴스(예: VM.Standard.E2.1.Micro) → linux_amd64
#   ARM(Ampere, VM.Standard.A1.Flex)            → linux_arm64
#   확인법: `uname -m` → x86_64 면 amd64, aarch64 면 arm64.
#   https://github.com/bluenviron/mediamtx/releases 에서 최신 버전 확인 후 URL 교체 가능.
cd /tmp
# --- AMD/Intel (amd64) — 이 배포는 E2.1.Micro라 이걸 사용 ---
curl -L -o mediamtx.tar.gz \
  https://github.com/bluenviron/mediamtx/releases/download/v1.19.2/mediamtx_v1.19.2_linux_amd64.tar.gz
# --- ARM(Ampere)라면 위 대신 아래 사용 ---
# curl -L -o mediamtx.tar.gz \
#   https://github.com/bluenviron/mediamtx/releases/download/v1.19.2/mediamtx_v1.19.2_linux_arm64.tar.gz
tar xzf mediamtx.tar.gz
sudo mv mediamtx /opt/mediamtx/mediamtx
sudo chmod +x /opt/mediamtx/mediamtx

# 4-3. repo clone (설정/프론트 모두 여기서 사용)
sudo git clone https://github.com/kminzy23/MBC_app_v2.git /opt/mbc-app

# 4-4. 프로덕션 설정 배치
sudo cp /opt/mbc-app/deploy/mediamtx.prod.yml /opt/mediamtx/mediamtx.yml

# 4-5. publish 비밀번호 교체 — CHANGE_ME_STRONG_PASSWORD 를 실제 강한 값으로.
sudo nano /opt/mediamtx/mediamtx.yml

# 4-6. 권한
sudo chown -R mediamtx:mediamtx /opt/mediamtx

# 4-7. systemd 유닛 등록
sudo cp /opt/mbc-app/deploy/mediamtx.service /etc/systemd/system/mediamtx.service
sudo systemctl daemon-reload
sudo systemctl enable --now mediamtx
sudo systemctl status mediamtx --no-pager   # active (running) 확인
```

## 5. 앱 배포 (config.js 생성)

`frontend/js/config.js`는 gitignore라 clone에 없다. 서버에서 직접 생성(로컬 값과 동일):
```bash
sudo tee /opt/mbc-app/frontend/js/config.js >/dev/null <<'EOF'
window.SUPABASE_URL = 'https://<프로젝트REF>.supabase.co';
window.SUPABASE_ANON_KEY = '<anon-public-key>';
EOF
```
> 값 위치: Supabase 대시보드 → Project Settings → API (로컬 `frontend/js/config.js`와 동일).

Caddy(caddy 사용자)가 정적 파일을 읽도록 권한 부여:
```bash
sudo chmod -R a+rX /opt/mbc-app/frontend
```

## 6. Caddy 설치 + 도메인 설정

```bash
# 6-1. apt로 Caddy 설치(공식 저장소)
sudo apt update && sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# 6-2. 프로덕션 Caddyfile 배치 + 도메인/이메일 교체
sudo cp /opt/mbc-app/deploy/Caddyfile.prod /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # YOUR-NAME.duckdns.org, YOUR-EMAIL 교체

# 6-3. 적용(자동 HTTPS 발급)
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager
sudo journalctl -u caddy -n 30 --no-pager   # "certificate obtained" 로그 확인
```

## 7. Supabase 도메인 등록

Supabase 대시보드 → Authentication → URL Configuration:
- **Site URL**: `https://<이름>.duckdns.org`
- **Redirect URLs**에 `https://<이름>.duckdns.org/**` 추가(이메일 확인/재설정 흐름용).

## 8. OBS 송출 (인증)

OBS → 설정 → 방송:
- 서비스: **사용자 지정**
- 서버: `rtmp://<이름>.duckdns.org/live`
- 스트림 키: `tv1?user=publisher&pass=<위에서-정한-비밀번호>`

→ 방송 시작하면 `https://<이름>.duckdns.org/live/tv1/index.m3u8` 로 재생 가능.
(다른 채널은 `tv1` 대신 해당 스트림 키 사용 — 채널 `path`가 `live/<키>`.)

## 9. 검증 (완료 기준)

- [ ] 브라우저에서 `https://<이름>.duckdns.org` → **자물쇠(유효 인증서)** 표시.
- [ ] 로그인 → player에 채널 카드 표시 → tv1 재생.
- [ ] **휴대폰 LTE/5G(WiFi 끄고)** 에서 접속·로그인·재생 성공.
- [ ] 인증 없는 RTMP push(`user/pass` 없이)는 **거부**된다(OBS "연결 실패").
- [ ] 서버 재부팅 후 `systemctl status mediamtx`,`caddy` 모두 자동 active.

## 문제 해결

- **인증서 발급 실패**: 80/443 방화벽(2단계 모두), DuckDNS IP == 서버 IP 확인.
  `sudo journalctl -u caddy -f` 로 ACME 로그 관찰.
- **재생 안 됨/오프에어**: `systemctl status mediamtx`, OBS가 실제 push 중인지, 스트림 키의
  user/pass 확인. 서버에서 `curl -s http://127.0.0.1:8888/live/tv1/index.m3u8 | head` 로 HLS 생성 확인.
- **403(정적 파일)**: `sudo chmod -R a+rX /opt/mbc-app/frontend` 재실행.
- **RTMP는 되는데 시청자만 실패**: `/live/*` 프록시(Caddyfile)와 `config.js` 존재 확인.
- **로그인 화면만 반복**: Supabase URL Configuration(7절)에 프로덕션 도메인이 등록됐는지 확인.

## 업데이트(코드 변경 반영)

```bash
cd /opt/mbc-app && sudo git pull
sudo chmod -R a+rX /opt/mbc-app/frontend
# 설정을 바꿨다면 해당 서비스만 재시작
sudo systemctl restart mediamtx   # mediamtx.prod.yml 변경 시
sudo systemctl restart caddy      # Caddyfile 변경 시
```
> `config.js`는 gitignore라 `git pull`에 영향받지 않는다(서버 로컬 파일 유지).

## 범위/다음
- 스트림 주소 자체 보호(서명 URL) → **Phase 6**
- PWA(홈 화면 추가·오프라인 셸) → **Phase 7**
- 운영/모니터링(헬스체크·트래픽) → **Phase 8**
