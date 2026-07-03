# Phase 1 설계 — 스트림을 흐르게 하기 (로컬)

> 방송 스트림 모니터링 앱의 첫 단계. 영상 소스가 HLS로 재생되는 것을 로컬에서 증명한다.
> 상위 계획: `방송 스트림 모니터링 앱_구현계획서.mc`

## 목표

로컬 환경(Windows 11)에서 OBS로 내보낸 방송 소스가 MediaMTX를 거쳐 HLS로 변환되고,
PC와 같은 WiFi의 휴대폰에서 재생되는 것을 확인한다. 이것이 성공하면 이후 Phase는
여기에 하나씩 붙여나가는 작업이다.

## 확정 사항

| 항목 | 결정 |
|------|------|
| 설치 방식 | `mediamtx.exe` 바이너리 직접 실행 (Windows amd64) |
| 테스트 소스 | OBS Studio → RTMP push |
| 검증 범위 | PC(localhost) + 같은 WiFi 휴대폰 (`<PC-IP>:8888`) |
| 채널 | TV(영상+음성) 1개 + 라디오(오디오 전용) 1개 |
| 다른 네트워크 접속 | 범위 밖 — Phase 5(공개 배포)에서 해결 |

## 아키텍처 / 데이터 흐름

```
OBS Studio ──RTMP:1935──▶ MediaMTX ──HLS:8888──▶ VLC / 브라우저 / 폰
(rtmp://localhost/live/<키>)  [mediamtx.exe]   (http://<주소>:8888/<키>/index.m3u8)
```

### 구성 요소

- **MediaMTX** (mediamtx.exe): RTMP를 1935 포트에서 수신하고 HLS를 8888 포트로 출력한다.
  동작은 `mediamtx.yml` 설정 파일 하나로 제어한다. 공식 바이너리를 다운로드해 실행하므로
  우리가 작성하는 산출물은 설정과 문서다.
- **OBS Studio**: 방송 소스 역할. 설정 → 방송(Stream)에서 서비스 "사용자 지정(Custom)",
  서버 `rtmp://localhost:1935/live`, 스트림 키로 채널을 구분한다(`tv1`, `radio1`).
  - TV 채널: 화면 캡처/미디어 소스 + 오디오
  - 라디오 채널: 오디오 소스만 (영상 없이 오디오 전용 스트림 확인)
- **뷰어**: PC는 `http://localhost:8888/<키>/index.m3u8`, 같은 WiFi 폰은
  `http://<PC-IP>:8888/<키>/index.m3u8`.

## 산출물

```
/MBC_app_v2
  mediamtx.yml          # MediaMTX 설정 (RTMP 수신 + HLS 출력)
  README-phase1.md      # 실행 순서, OBS 설정값, 검증 방법 정리
  /bin                  # mediamtx.exe (다운로드본) — 버전관리 제외 권장
```

`mediamtx.yml`에서 활성화할 핵심 설정:
- RTMP 수신 활성화 (기본 포트 1935)
- HLS 출력 활성화 (기본 포트 8888)
- `live` 경로에서 임의 스트림 키 publish/read 허용 (Phase 1은 인증 없이 단순하게)

## 검증 기준 (완료 조건)

1. OBS에서 "방송 시작" → MediaMTX 로그에 publish 수신이 찍힌다.
2. PC의 VLC 또는 브라우저에서 `http://localhost:8888/tv1/index.m3u8`가 재생된다.
3. 같은 WiFi 폰 브라우저에서 `http://<PC-IP>:8888/tv1/index.m3u8`가 재생된다.
   (Windows Defender 방화벽 inbound TCP 8888 허용 규칙 추가 후)
4. 라디오(오디오 전용) 스트림 `radio1`도 동일하게 재생된다.

## 방화벽

- 폰 접속을 위해 Windows Defender 방화벽에 **inbound TCP 8888** 허용 규칙 1개를 추가한다.
- 1935(RTMP)는 localhost에서만 사용하므로 외부로 개방하지 않는다.

## 범위 밖 (이후 Phase)

- 웹 플레이어 페이지 (Phase 2)
- 로그인/인증 (Phase 3)
- 공개 서버 배포 및 다른 네트워크 접속 (Phase 5)
- 인제스트 publish 인증 (Phase 5~6)

## 결정 근거 요약

- **바이너리 직접 실행**: 1인 개발 로컬 테스트에 가장 단순. Docker 불필요.
- **OBS**: 실제 방송 인코더 없이도 RTMP push를 손쉽게 재현. 라디오(오디오 전용)도 소스 구성만으로 테스트 가능.
- **같은 WiFi까지만 검증**: 사설 IP는 같은 LAN에서만 도달 가능. 다른 대역 접속은
  NAT 때문에 로컬 단계에서 불가하며, Phase 5의 공개 배포로 정식 해결한다.
