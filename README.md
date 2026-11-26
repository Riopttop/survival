# Lantern Ward (가제)

뱀서라이크(서바이버류) 탑다운 로그라이트. Phaser 3 + Vite.
PC(키보드)와 모바일(터치 드래그 조이스틱) 모두 지원합니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버 (같은 Wi-Fi의 휴대폰에서도 접속 가능)
npm run build    # dist/ 에 배포용 빌드
```

## 조작
- PC: WASD / 방향키로 이동, 공격은 자동. 레벨업 카드는 클릭 또는 1/2/3 키.
- 모바일: 화면 아무 곳이나 누르고 드래그해서 이동.

## 구성
- `src/data.js` — 밸런스 수치(체력, 속도, 무기, 스폰 곡선)는 전부 여기서 조절
- `src/scenes/GameScene.js` — 게임 로직 (이동, 적, 무기, 경험치)
- `src/scenes/UIScene.js` — HUD, 조이스틱, 레벨업 카드, 결과 화면
- `src/i18n.js` — 한국어/영어 문구 (브라우저 언어로 자동 선택)
- `public/assets/` — 스프라이트 PNG

## 그림 교체
`public/assets/` 의 PNG는 임시 픽셀아트(`npm run sprites`로 생성)입니다. 같은 이름, 같은 크기로 바꾸면 바로 적용됩니다.
- `hero.png` — 주인공, 16x16 프레임 2개 가로 배치 (SpriteCook으로 교체 예정)
- `slime.png`, `bat.png`, `brute.png` — 적, 16x16 프레임 2개 가로 배치 (Kenney CC0 등으로 교체 가능)
- `gem.png`, `bolt.png`, `heart.png` (8x8), `blade.png` (12x12), `ground.png` (32x32 반복 타일)
