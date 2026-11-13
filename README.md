# MVN Move On

운동 루틴 플레이어의 로컬 개발 서버입니다. 이 PC 한 대에서 PostgreSQL, Redis, 영상 저장소와 API를 띄우고, 관리자 웹은 그 API에 붙습니다.

## 실행

```powershell
Copy-Item .env.example .env
Copy-Item .env.example packages/db/.env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm dev
```

- 관리자: http://localhost:3000
- API 상태: http://localhost:3001/health
- 영상 저장소(LocalStack S3): http://localhost:4566

이 PC에 PostgreSQL이 이미 5432를 쓰고 있어서, 개발용 데이터베이스는 5433으로 엽니다. 영상 파일은 LocalStack의 S3에 저장합니다.

로컬 비밀번호는 개발용입니다.
