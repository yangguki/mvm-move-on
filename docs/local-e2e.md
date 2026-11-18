# 로컬 E2E 테스트 가이드

## 사전 요구사항

- Node.js 18+, pnpm 8+
- Docker Desktop
- ffmpeg (`brew install ffmpeg`)
- aws CLI (`brew install awscli`)

## 빠른 시작

```bash
# 1. 인프라 (postgres, redis, localstack + S3 버킷)
pnpm infra:up

# 2. 패키지 설치 및 DB 준비
pnpm install
pnpm db:push
pnpm db:seed

# 3. 서버 실행 (API:3001, Admin:3000, Player:3002)
pnpm dev

# 4. E2E 테스트 (별도 터미널)
pnpm e2e

# HTML 스킨 (neon-arcade kind=html, seed-html-skin 후)
# 터미널 A: PORT=3011 pnpm dev:api
# 터미널 B:
pnpm e2e:html-skin
```

## 브라우저 확인

- 관리자: http://localhost:3000 (`inkuk.yang@mvmfit.kr` / `password`)
- 플레이어: http://localhost:3002

## 정리

```bash
# 서버 종료: Ctrl+C

# 인프라 종료 (데이터 유지)
pnpm infra:down

# 완전 삭제 (데이터 삭제)
docker compose down -v
```

## 트러블슈팅

| 문제 | 해결 |
|------|------|
| Docker 연결 실패 | Docker Desktop 실행 확인 |
| S3 업로드 실패 | `pnpm infra:up` 재실행 |
| shared 모듈 없음 | `pnpm --filter @mvn/shared build` |
| 영상 처리 실패 | `ffmpeg -version` 확인 |
