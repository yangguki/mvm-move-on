# 로컬 E2E 테스트 가이드

이 문서는 Mac 로컬 환경에서 관리자→영상 업로드→프로그램 생성→게시→플레이어 페어링→재생 전체 흐름을 테스트하는 방법을 설명합니다.

## 사전 요구사항

- **Node.js** 18+ (20 권장)
- **pnpm** 8+
- **Docker Desktop** (postgres, redis, localstack용)
- **ffmpeg** (영상 트랜스코딩용)

```bash
# ffmpeg 설치 (미설치 시)
brew install ffmpeg

# Docker Desktop 실행 확인
docker info
```

## 1. 인프라 실행

```bash
# docker-compose.yml이 있는 디렉토리에서
docker compose up -d

# 서비스 확인
docker compose ps
# postgres(5433), redis(6379), localstack(4566)가 모두 Up 상태여야 함
```

## 2. S3 버킷 생성 (최초 1회)

```bash
# LocalStack에 mvn-media 버킷 생성
aws --endpoint-url=http://localhost:4566 s3 mb s3://mvn-media

# 버킷 확인
aws --endpoint-url=http://localhost:4566 s3 ls
```

> **주의**: aws CLI가 없으면 `brew install awscli`로 설치하거나 Docker 컨테이너 내부에서 실행

## 3. 패키지 설치 및 빌드

```bash
# 의존성 설치
pnpm install

# shared 패키지 빌드 (API에서 CJS로 import)
pnpm --filter @mvn/shared build

# API 빌드
pnpm --filter @mvn/api build

# DB 마이그레이션
pnpm --filter @mvn/db push

# 시드 데이터 (테스트 유저, 지점 등)
pnpm --filter @mvn/db seed
```

## 4. 서버 실행

3개의 터미널 또는 백그라운드에서 실행:

### 터미널 1: API (NestJS, :3001)

```bash
cd apps/api
DATABASE_URL='postgresql://mvn:mvn@localhost:5433/mvn' \
S3_ENDPOINT='http://localhost:4566' \
S3_BUCKET='mvn-media' \
S3_ACCESS_KEY_ID='test' \
S3_SECRET_ACCESS_KEY='test' \
S3_PUBLIC_BASE_URL='http://localhost:4566/mvn-media' \
JWT_ACCESS_SECRET='mvn-local-dev-secret' \
node dist/main.js
```

### 터미널 2: Admin (Next.js, :3000)

```bash
pnpm --filter @mvn/admin dev
```

### 터미널 3: Player (Vite, :3002)

```bash
pnpm --filter @mvn/player dev
```

## 5. E2E 스모크 테스트

모든 서버가 실행 중일 때:

```bash
# 테스트 영상 생성 (없으면)
ffmpeg -y -f lavfi -i testsrc=duration=5:size=640x360:rate=30 \
  -f lavfi -i sine=frequency=440:duration=5 \
  -c:v libx264 -c:a aac /tmp/test-video.mp4

# E2E 테스트 실행
node scripts/e2e-smoke.mjs
```

성공 시 출력:
```
=== ALL STEPS PASSED ===

브라우저 확인:
  관리자: http://localhost:3000/programs
  플레이어: http://localhost:3002
  페어링 코드: XXXXXX
```

## 6. 브라우저 확인

1. **관리자 로그인**: http://localhost:3000
   - 이메일: `inkuk.yang@mvmfit.kr`
   - 비밀번호: `password`

2. **프로그램 빌더**: http://localhost:3000/programs
   - 영상 업로드, 프로그램 생성, 게시

3. **플레이어 앱**: http://localhost:3002
   - 페어링 코드 입력 → 프로그램 선택 → 재생

## 테스트 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 관리자 | inkuk.yang@mvmfit.kr | password |

시드 데이터로 생성된 지점: **거여역점**

## 트러블슈팅

### Docker 서비스 연결 실패
```bash
docker compose down && docker compose up -d
```

### S3 업로드 실패
```bash
# 버킷 존재 확인
aws --endpoint-url=http://localhost:4566 s3 ls

# 없으면 재생성
aws --endpoint-url=http://localhost:4566 s3 mb s3://mvn-media
```

### DB 연결 실패
```bash
# postgres 컨테이너 확인
docker compose logs postgres

# 포트 충돌 시 다른 포트 사용
# docker-compose.yml에서 5433 -> 다른 포트
```

### 영상 처리 실패
```bash
# ffmpeg 설치 확인
ffmpeg -version
ffprobe -version
```

### shared 모듈 못 찾음
```bash
pnpm --filter @mvn/shared build
```

## 서비스 포트 요약

| 서비스 | 포트 | 용도 |
|--------|------|------|
| Admin | 3000 | 관리자 웹앱 (Next.js) |
| API | 3001 | REST API (NestJS) |
| Player | 3002 | 플레이어 PWA (Vite) |
| PostgreSQL | 5433 | 메인 DB |
| Redis | 6379 | 캐시/세션 |
| LocalStack | 4566 | S3 호환 스토리지 |

## 정리

```bash
# 서버 프로세스 종료
pkill -f "node dist/main"
pkill -f "next dev"
pkill -f "vite"

# Docker 서비스 종료 (데이터 유지)
docker compose stop

# Docker 서비스 완전 삭제 (데이터 삭제됨)
docker compose down -v
```
