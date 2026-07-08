# Phase 7 — 부산MBC 온에어 (브랜드 리스킨 + PWA)

## 무엇이 바뀌었나
- 라이트 MBC 브랜드 테마(퍼플 `#6706D3`, MBC NEW 폰트, 마스코트), 온에어=레드.
- PWA: 아이폰/안드로이드 홈 화면에 설치 → 전체화면 앱 실행.

## 배포 반영 (서버 SSH)
```bash
cd /opt/mbc-app && sudo git pull
sudo chmod -R a+rX /opt/mbc-app/frontend
```
> 코드 개편 시 `frontend/service-worker.js`의 `CACHE` 값을 올린다(v1→v2) → 옛 캐시 자동 정리.

## 아이폰에 앱으로 설치
1. Safari로 `https://mybusanmbc.duckdns.org` 접속
2. 공유 버튼 → **홈 화면에 추가**
3. 홈 화면의 **마스코트 아이콘** 실행 → 주소창 없는 전체화면

## 아이콘/마스코트 재생성 (로고 교체 시)
```bash
python tools/make_mascot_png.py   # 원본(검정 배경) → 투명 PNG(frontend/images/mascot.png)
python tools/make_icons.py        # mascot.png → PWA 아이콘(180/192/512/maskable)
```
> 원본 마스코트는 `assets/images/MBC_icon.jpg`(검정 배경). 라이트 테마용으로 검정을 투명 처리해서 씀.

## 검증 체크리스트
- [x] 세 화면이 라이트 브랜드 테마로 표시(MBC NEW·퍼플·마스코트) — 로컬 확인
- [x] 매니페스트 유효(부산MBC 온에어, standalone) + 서비스워커 activated — 로컬 확인
- [x] 서비스워커 캐시에 `/live/*`·`config.js` 없음(재생·인증 무영향) — 로컬 확인
- [ ] 아이폰 홈 화면 추가 → 아이콘 실행 → 전체화면 (실기기)

## 범위 밖 / 다음
- 스트림 서명 URL 접근제한 = **Phase 6**. 네이티브(Capacitor) = Mac 확보 후 이 PWA 재활용.
