# 매장용 플레이어 PWA MVP (+ 작은 정리 3건)

## Goal
매장 TV(삼성 Tizen, LG webOS 내장 브라우저)에서 도는 플레이어 앱 `apps/player` MVP를 만든다.

## Context / decisions already made
- pnpm 모노레포: `apps/admin`(Next.js, 3000), `apps/api`(NestJS, 3001), `packages/db`(Prisma, Postgres 5433), `packages/shared`(`@mvn/shared`: 타입, validateProgram, expand, collectVideoRefs, PublishedSnapshot/VideoMap, audio resolve).
- 게시 스냅샷에 영상(videos 맵)과 오디오가 동결돼 있음(`54edb44`). `GET /player/v1/programs/:id`는 `expand(snapshot, videos)` 결과와 `videos`를 돌려줌.
- 변경은 재게시 때만 반영(정책 B). 영상 반복은 클라이언트 A/B 이중 버퍼(neon-arcade `player.js`에 구현됨). 서버 쪽 이어붙이기 없음.
- 대상 브라우저 때문에 ES2017로 출력.
- 스킨 id는 `neon-arcade`로 통일(seed slug도 같아야 함). 시작 카운트다운은 스킨 옵션.
- 관리자에서 기기 6자리 페어링 코드 발급은 이미 있음.

## Relevant files
- `apps/admin/public/skins/neon-arcade/{index.html,player.js,expand.js}`
- `apps/api/src/player.controller.ts` 와 기기/페어링 관련 컨트롤러
- `packages/shared/src/{program.ts,validate.ts,index.ts}`, `packages/shared/test/expand.test.mjs`
- `packages/db/prisma/{schema.prisma,seed.js}`
- `apps/admin/app/(console)/programs/builder-screen.tsx`
- 루트 `package.json`

## Done so far
없음(이 작업은 새로 시작).

## Next steps
A. 작은 정리
1. seed의 스킨 slug `neon` → `neon-arcade`로 맞추기(기존 데이터는 마이그레이션 또는 seed upsert로 정리).
2. 빌더에서 영상 선택 시 durationSec를 영상 길이로 미리 채우기(값이 있으면 덮지 않음).
3. validateProgram에서 그룹 안 그룹(중첩) 금지 검증 + 테스트 1개.

B. `apps/player` PWA MVP
1. Vite + 가벼운 TS, 빌드 타깃 ES2017, 리모컨 키(방향키, Enter, Back) 대응.
2. 흐름: 페어링 화면(6자리 코드 입력 → `POST /player/v1/pair`가 기기 토큰 발급 → localStorage 저장) → 대기 목록(`GET /player/v1/programs`, 토큰 헤더) → 재생(neon-arcade `player.js` 재사용, 시작 카운트다운 스킨 옵션 반영) → 완료 화면 → 대기로 복귀.
3. Enter로 일시정지/재개, 네트워크·재생 오류 화면과 재시도.
4. manifest, 서비스워커는 앱 셸만 캐시(영상 캐시 X).
5. API에 기기 토큰 가드(플레이어 API 보호), 없는 엔드포인트(pair, 목록)는 추가.
6. 루트 `pnpm dev`에 player(포트 3002) 추가.

## Done criteria and tests to run
- `@mvn/shared` 테스트 통과(중첩 그룹 테스트 포함).
- admin, api, player `tsc --noEmit` 통과, `apps/player` 빌드 1회 성공.
- 서버가 필요한 확인은 백그라운드로 띄우고 끝나면 반드시 종료.

## Constraints
- 이 작업만, 관련 없는 리팩터링 금지
- 관련 테스트·컴파일 확인만 실행
- 커밋·푸시·배포 금지(커밋·푸시는 사용자 확인 후 봇이 함)
- `pnpm dev`, `next dev`, `nest start --watch` 같은 끝나지 않는 서버를 포그라운드로 실행 금지
- `.env` 읽기·수정 금지, `.env.example`엔 로컬 값만
- 같은 오류가 두 번 반복되면 멈추고 원인과 선택지 보고

## Report back
변경 파일 요약, 테스트 결과, 로컬 확인 방법, 남은 문제(짧게)
