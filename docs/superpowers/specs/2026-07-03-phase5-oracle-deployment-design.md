# Phase 5 설계 — 공개 배포 (Oracle Cloud)

> 방송 스트림 모니터링 앱의 다섯 번째 단계. 로컬에서 완성한 앱을 Oracle Ubuntu 서버에
> 올려 어디서든(모바일 데이터 포함) HTTPS로 로그인·시청 가능하게 한다.
> 상위 계획: `방송 스트림 모니터링 앱_구현계획서.md` / 선행: Phase 1~4 (로컬 완성)

## 목표

로컬에서 검증한 앱(MediaMTX + Caddy same-origin + Supabase 로그인 + DB 채널)을 공개 서버로
이전하여 `https://<이름>.duckdns.org` 로 접속·로그인·재생되게 한다.

## 확정 사항

| 항목 | 결정 |
|------|------|
| 서버 | Oracle Cloud Always Free **ARM(Ampere) + Ubuntu** (이번에 생성) |
| 도메인 | **DuckDNS**(무료 서브도메인) |
| HTTPS | Caddy 자동 발급(Let's Encrypt, HTTP-01 챌린지, 포트 80) |
| 인제스트 보안 | MediaMTX **publish 인증**(전용 계정). HLS 읽기는 공개(프록시 뒤) |
| 프론트 서빙 | Caddy 정적 서빙 + `/live/*` 리버스 프록시 (로컬과 동일 same-origin) |
| 프로세스 관리 | systemd (MediaMTX), apt 설치 Caddy 서비스 |

## 프로덕션 아키텍처

```
방송 OBS ──RTMP(인증)──▶ [Oracle Ubuntu 서버 (ARM)]
  rtmp://도메인:1935/live/tv1     MediaMTX  (:1935 RTMP publish 인증, :8888 HLS)
  (user/pass 필요)                Caddy (:80/:443, 자동 HTTPS)
                                    /        → frontend 정적 파일
                                    /live/*  → reverse_proxy 127.0.0.1:8888
브라우저(어디서든) ──HTTPS──▶ https://<이름>.duckdns.org
                                    ▲ 로그인/DB는 Supabase(클라우드) 그대로 사용
```

## 프론트 코드는 변경 없음

- `buildHlsUrl`이 `location.host` 기반이라 도메인만 바뀌면 그대로 동작(same-origin 유지).
- 서버에서 할 일은 **배포 + 설정**뿐:
  - `frontend/js/config.js` 생성(Supabase URL/anon key, gitignore이므로 서버에서 직접 생성)
  - Supabase 대시보드 Redirect URL/Site URL에 `https://<이름>.duckdns.org` 추가
- 채널 데이터(Supabase DB)와 경로(`live/tv1` 등)는 그대로 재사용.

## 산출물 (repo에 추가할 배포 설정)

```
deploy/
  Caddyfile.prod        # 도메인 기반 HTTPS + 정적 서빙 + /live 프록시
  mediamtx.prod.yml     # RTMP publish 인증(authInternalUsers) + HLS(alwaysRemux)
  mediamtx.service      # systemd 유닛(부팅 시 자동 시작·재시작)
README-phase5.md        # SSH 단계별 배포·검증 가이드
```

- `mediamtx.prod.yml`의 publish 비밀번호는 자리표시자로 두고, 서버에서 실제 값으로 교체(커밋 금지).
- `Caddyfile.prod`의 도메인도 실제 DuckDNS 이름으로 서버에서 교체.

## 실행 모델

서버는 원격이므로 브라우저/CLI 자동화로 직접 접속할 수 없다. **설정 파일과 정확한 명령을
준비하고, 사용자가 SSH로 서버에서 실행**하는 방식으로 진행한다. (Windows에서 SSH 접속 후 붙여넣기)

## 배포 단계 (개요 — 상세는 구현 계획에서)

1. **인스턴스**: Oracle 계정 → Always Free ARM(Ubuntu) 인스턴스 생성 → **고정 공인 IP 예약** → SSH 접속.
2. **포트 개방**: OCI 보안목록 + Ubuntu 방화벽(iptables/ufw)에서 **80, 443, 1935** 허용.
3. **DuckDNS**: 서브도메인 생성 → 서버 공인 IP로 연결.
4. **MediaMTX**: arm64 바이너리 설치 + `mediamtx.prod.yml`(publish 인증) 배치 + systemd 등록.
5. **Caddy**: apt 설치 + `Caddyfile.prod`(도메인) 배치 → 재시작 시 자동 HTTPS 발급.
6. **앱 배포**: repo clone(또는 파일 업로드) + `config.js` 생성(Supabase 키) → Caddy가 서빙.
7. **Supabase**: Redirect URL/Site URL에 프로덕션 도메인 추가.
8. **검증**: OBS로 `rtmp://도메인/live/tv1`(인증) push → **모바일 데이터**에서 도메인 접속·로그인·재생.

## 인제스트 인증 (MediaMTX)

`authInternalUsers`로 익명은 읽기만, 지정 계정만 publish 허용:
- 익명(`any`): `read`(HLS 재생) 허용.
- 전용 퍼블리셔 계정(user/pass): `publish` 허용.
OBS는 `rtmp://도메인:1935/live` + 스트림 키에 자격증명(쿼리)로 push. 정확한 형식은 계획에서 확정.

## 완료 기준

- 휴대폰(LTE/5G, WiFi 아님)에서 `https://<이름>.duckdns.org` 접속 → 로그인 → 채널 재생.
- 인증 없는 RTMP push는 거부된다(publish 인증 동작).
- Caddy가 유효한 HTTPS 인증서를 서빙한다(브라우저 자물쇠).

## 위험 / 주의

- **ARM 무료 용량 부족**: 지역/시간에 따라 인스턴스 생성이 거부될 수 있음 → 재시도 또는 다른 가용 도메인(AD)/리전.
- **비밀값 관리**: publish 비밀번호·Supabase 키는 서버에만 두고 커밋하지 않는다.
- **대역폭**: 업로드 대역폭이 유일한 실제 제약(예: 2Mbps×동시 N명). Oracle 무료 10TB/월 내에서 초기 충분.
- 저지연 불필요라 HLS 10~20초 지연은 정상.

## 범위 밖 (이후 Phase)

- 스트림 주소 자체 보호(서명 URL) — Phase 6
- PWA — Phase 7
- 운영/모니터링(헬스체크·트래픽) — Phase 8

## 결정 근거 요약

- **DuckDNS 무료**: 도메인 비용 $0로 Caddy 자동 HTTPS 확보. 나중에 유료 도메인으로 교체 가능.
- **publish 인증**: 고정 IP가 없어도 어디서든 인증으로 push 가능, RTMP 무단 주입 차단.
- **same-origin 유지**: 로컬에서 iOS 사파리 문제를 해결한 Caddy 프록시 구조를 그대로 프로덕션에 적용 → 프론트 코드 무변경.
