# Lantern Ward (가제)

HD-2D 스타일 뱀서라이크(서바이버류) 로그라이트. 3D 배경(Three.js) 위에 2D 픽셀 캐릭터가 서 있는 방식입니다.
PC(키보드)와 모바일(터치 드래그 조이스틱) 모두 지원합니다.

## 실행

```bash
npm install
npm run dev           # 개발 서버 (같은 Wi-Fi의 휴대폰에서도 접속 가능)
npm run build         # dist/ 에 배포용 빌드
npm run build:single  # dist-single/index.html 한 파일짜리 빌드 (미리보기 공유용)
```

## 조작
- PC: WASD / 방향키 이동, 공격 자동, 레벨업 카드는 클릭 또는 1/2/3, ESC/P 일시정지
- 모바일: 화면을 누르고 드래그해서 이동

## 구성
- `src/data.js` 밸런스 수치(체력, 속도, 무기, 적, 스폰 곡선)
- `src/game/game.js` 게임 로직 (이동, 적, 무기, 경험치, 이펙트)
- `src/engine/world.js` 3D 월드: 조명, 그림자, 안개, 지형 셰이더, 소품 배치, 후처리(블룸·틸트시프트)
- `src/engine/sprites.js` 2D 픽셀 스프라이트를 3D에 세우는 인스턴싱 배치
- `src/engine/particles.js` 파티클
- `src/ui/` HTML HUD, 레벨업 카드, 메뉴 (Galmuri 픽셀 폰트)
- `src/i18n.js` 한국어/영어 문구

## 그림 교체
- 주인공: `src/assets/sprites/wizard.png` (임시, Kenney Tiny Dungeon). SpriteCook 그림으로 바꾸고 `src/data.js` 의 `PLAYER.sprite` 를 새 파일 이름으로.
- 적: `src/assets/sprites/*.png` (Kenney Tiny Dungeon, 16x16)
- 3D 소품: `src/assets/models/*.glb` (Kenney Nature Kit)
- 이펙트: `src/assets/fx/*.png` (Kenney Particle Pack)

## 라이선스
에셋 라이선스는 `LICENSES/` 폴더에 있습니다. Kenney 에셋은 CC0, Galmuri 폰트는 SIL OFL 1.1입니다.
