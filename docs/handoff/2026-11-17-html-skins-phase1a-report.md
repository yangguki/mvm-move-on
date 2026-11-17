# HTML 스킨 1단계 (1a) 작업 보고

## 바꾼 파일 (요약)

| 영역 | 경로 |
|------|------|
| DB | `packages/db/prisma/schema.prisma`, `migrations/20261117100000_html_skins/` |
| shared | `packages/shared/src/html-skin/*`, `program.ts`, `validate.ts`, `test/html-skin.test.mjs` |
| API | `skins.controller.ts`, `skin-screens.controller.ts`, `html-skin-publish.ts`, `programs.controller.ts`, `app.module.ts`, `test/html-skin-publish.test.mjs` |
| 관리자 | `skins-view.tsx`, `html-skin-panel.tsx` |
| 플레이어 | `main.ts`, `html-skin-player.ts`, `vite.config.ts`, `package.json` |
| 스크립트 | `scripts/seed-html-skin.mjs`, `scripts/html-preview-screenshots.mjs` |

## 구현 내용

- **1-1 데이터**: `Skin.kind` (`tokens` \| `html`), `SkinScreen` 모델, 단계 `screenId`, 발행 시 html 화면 스냅샷(`skin.screens`, 정책 B + `needsRepublish` 화면 `version` 비교).
- **1-2 관리자**: HTML 스킨 등록(제목만), 화면 CRUD·순서·플래그, HTML/CSS 편집, sandbox `srcdoc` 미리보기, 토큰 목록.
- **1-3 플레이어**: `skin.kind === "html"`이면 `HtmlSkinPlayer`(sanitize된 srcdoc, 토큰 postMessage, 영상 슬롯 오버레이), tokens 스킨은 기존 neon-arcade iframe 유지.

## 테스트 결과

| 항목 | 결과 |
|------|------|
| `pnpm --filter @mvn/shared test` | **8/8 통과** |
| `pnpm --filter @mvn/api test` | **6/6 통과** |
| `tsc --noEmit` (admin / api / player) | **통과** |
| `pnpm db:migrate` (로컬) | **실패** — Postgres(`localhost:5433`) 미기동 (Docker Desktop 없음) |
| `node scripts/seed-html-skin.mjs` | **미실행** (DB 없음) |
| `API=http://localhost:3011 node scripts/e2e-smoke.mjs` | **미실행** — 3001/3011 API health 응답 없음 |
| Puppeteer 스크린샷 | **성공** |

## 스크린샷

- `docs/skins/html-preview-exercise.png`
- `docs/skins/html-preview-title-only.png`

## 남은 문제 / 후속

1. **로컬 DB 마이그레이션**: `pnpm infra:up` 후 `pnpm db:migrate`, `node scripts/seed-html-skin.mjs` 실행 필요.
2. **E2E**: `PORT=3011`로 API 백그라운드 기동 후 `API=http://localhost:3011 node scripts/e2e-smoke.mjs` (사용자 `pnpm dev` 3001은 건드리지 않음).
3. **프로그램 빌더 UI**에서 `screenId` 연결은 다음 작업(핸드오프 범위 밖).
4. HTML 플레이어 **pause/resume·연속 영상 단일 재생**은 tokens 엔진 수준으로 아직 단순화됨(단계별 타이머 + 슬롯 배치).
5. Puppeteer 최초 실행 시 `npx puppeteer browsers install chrome` 필요했음(이번 세션에서 설치 완료).

## 규칙 준수

- 커밋·푸시·PR·브랜치 생성 없음.
- `.env` 미접근 (마이그레이션 시 `.env.example`과 동일한 `DATABASE_URL`만 셸에 주입 시도).
- 사용자 `pnpm dev` 프로세스 종료 없음.