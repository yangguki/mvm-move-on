# HTML 스킨 1b 작업 보고

## A (1-4): neon-arcade HTML 화면 이전 — 완료

### 바꾼 파일

| 영역 | 경로 |
|------|------|
| 화면 소스 | `packages/shared/neon-arcade-screens/` (`manifest.json`, `base.css`, 화면 HTML 10개, `load.mjs`) |
| shared | `src/html-skin/tokens.ts` (`set`/`setTotal` 토큰), `src/html-skin/neon-arcade.ts`, `test/html-skin.test.mjs` |
| 스크립트 | `scripts/seed-html-skin.mjs` (sample + neon-arcade upsert), `scripts/html-preview-screenshots.mjs` (10장) |
| 스크린샷 | `docs/skins/neon-html-<화면제목>.png` × 10 |

### 구현 요약

- POWER BELL 기준 화면 10종, 네온 아케이드 토큰 색·스캔라인·바닥 그리드 스타일을 `base.css`로 공유, 화면별 자유 레이아웃(고정 공용 레이아웃 미사용).
- 슬롯: 웜업·운동 `data-mvn-video`, 휴식·체인지 후 미리보기 `data-mvn-next-video`, 체인지 이동 안내 문구 고정.
- `seed-html-skin.mjs`는 DB 기동 시 파일 기반으로 neon-arcade `kind=html` + 화면 upsert (스킨 행 삭제 없음, 기존 `tokens` JSON 유지 시도). **미실행** (DB 없음).
- tokens 엔진·`apps/admin/public/skins/neon-arcade/` 미변경.

### 테스트·검증

| 항목 | 결과 |
|------|------|
| `pnpm --filter @mvn/shared test` | **19/19 통과** (기존 8 + neon 화면 11) |
| `pnpm --filter @mvn/api test` | **6/6 통과** |
| `tsc --noEmit` (admin / api / player) | **통과** |
| `node scripts/html-preview-screenshots.mjs` | **10 PNG 생성** |

### 남은 점 (A)

- DB 온 후 `node scripts/seed-html-skin.mjs`로 neon-arcade html 화면 반영 필요.
- 동일 slug에 `kind=html`로 upsert 시 기존 tokens 프로그램과의 공존 정책은 1-5·2단계에서 정리.

## B (1-5): 빌더 스텝 화면·영상·시간 — 완료

### 바꾼 파일

| 영역 | 경로 |
|------|------|
| shared | `src/html-skin/validate-program.ts`, `src/html-skin/index.ts`, `test/html-skin.test.mjs` |
| API | `apps/api/src/programs.controller.ts` (`asDraft` + html 화면 검증) |
| 관리자 | `apps/admin/app/(console)/programs/builder-screen.tsx` |

### 구현 요약

- `kind=html` 스킨 선택 시 스킨 화면 목록 로드, 스텝마다 `screenId` 선택(재사용 가능).
- `hasVideoSlot` 화면만 운동 영상 UI; 영상 선택 시 `durationSec`을 영상 길이로 채움(수정 가능), 영상 길이 읽기 전용 표시.
- 슬롯 없는 화면으로 바꾸면 `videoId` 제거. `hasNextVideoSlot`은 별도 영상 없음(플레이어 `html-skin-player` 기존 `next` 규칙 유지).
- `tokens` 스킨 프로그램 빌더는 기존 단계 유형·영상 UX 그대로.
- 저장 검증: `validateHtmlProgramSteps` (screenId·화면 소속·영상 슬롯 시 videoId·슬롯 없을 때 videoId 금지); API `PUT/POST` draft 시 DB 화면 목록과 대조.

### 테스트·검증

| 항목 | 결과 |
|------|------|
| `pnpm --filter @mvn/shared test` | **23/23 통과** (+ html 스텝 검증 4) |
| `pnpm --filter @mvn/api test` | **6/6 통과** |
| `tsc --noEmit` (admin / api / player) | **통과** |

### 남은 점 (B)

- DB·seed 후 실제 `kind=html` neon-arcade 스킨으로 관리자 빌더 E2E 확인 필요.
- html 스킨 TV 미리보기는 여전히 tokens iframe 폴백(1-5 범위 외).

## 후속: 미리보기 스크린샷·운동 HUD (2026-11-17)

- **스크린샷**: `html-preview-screenshots.mjs` — 고정 CSP nonce(연속 `setContent` 시 런타임 스크립트 차단 방지), `postMessage` + 텍스트에 `{{` 없을 때까지 대기, `HTML_SKIN_SAMPLE_TOKENS`(POWER BELL 샘플) 일괄 치환, `html-preview-*.png` 2장 복원. `neon-html-*.png` 10장 재생성.
- **레이아웃**: `exercise.html`·`warmup.html` + `base.css` `.na-hud-top` / `.na-bar` / `.na-vbox` — STEP·라벨·타이머 겹침·잘림(샘플 12/74·케틀벨 스윙·38초) 1920×1080 기준 정리.
- **검증**: shared·api 테스트 및 admin/api/player `tsc --noEmit` 통과.

## 규칙 준수

- main 작업, 커밋·푸시·PR·브랜치 없음.
- `.env` 미접근, migrate/seed/e2e 미실행, 사용자 3000/3001/3002 dev 서버 미사용.