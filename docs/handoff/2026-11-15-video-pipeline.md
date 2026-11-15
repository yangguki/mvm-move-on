# 영상 처리 흐름 (업로드 → 분석 → 변환 → 저장)

## Goal
관리자가 영상(mp4, mov, webm, GIF)을 올리면 서버가 길이·해상도를 뽑고, 썸네일을 만들고, TV 호환 H.264 mp4로 변환해서 오브젝트 스토리지(운영 R2, 개발 LocalStack S3)에 저장한다. 관리자 `/videos` 화면을 채운다.

## Context / decisions already made
- 인프라: Cloudflare Pages(프론트), Cloudflare R2(영상), 작은 서버 1대(NestJS, PostgreSQL, ffmpeg). 비용 최소.
- GIF는 mp4로 변환(기획 v1.6). 대상은 Tizen·webOS TV 내장 브라우저라서 H.264(High 이하) + yuv420p + faststart, 오디오는 없애거나 AAC.
- 영상은 짧은 클립(대략 3~15초)이고 플레이어가 A/B 이중 버퍼로 반복 재생함. 서버에서 이어붙이지 않음.
- 기존 URL 등록 방식(`videos` API의 URL 등록)은 유지. 업로드는 추가 기능.
- 게시 스냅샷에는 영상 정보(videos 맵)가 동결됨. 영상을 바꿔도 재게시 전까지 반영 안 됨(정책 B).
- 개발 환경엔 docker-compose에 LocalStack(4566), Redis(6379)가 있음.

## Relevant files
- `packages/db/prisma/schema.prisma` (model Video: name, url, durationSec, thumbnailUrl, width, height)
- `apps/api/src/videos.controller.ts`, `apps/api/src/app.module.ts`
- `apps/admin/app/(console)/videos/page.tsx` (현재 비어 있음)
- `apps/admin/app/(console)/audio/` (업로드·목록 화면 참고용)
- `.env.example` (로컬 값만)

## Next steps
1. 스토리지 모듈: S3 호환 클라이언트 1개(`@aws-sdk/client-s3`), 환경변수 `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`. 운영은 R2, 개발은 LocalStack. `.env.example`에 로컬 값만 추가하고 README의 S3 설명을 실제 코드에 맞게 고침.
2. Video 모델 확장(마이그레이션): `status`(uploading/processing/ready/failed), `sourceType`(url/upload), `error`, `sizeBytes`, `storageKey`. 기존 행은 `ready`, `url`로 채움.
3. 업로드 API: `POST /videos/upload`(multipart, 최대 100MB, 허용 형식만). 원본을 임시 폴더에 저장하고 Video 행을 `processing`으로 만든 뒤 바로 응답. 처리는 같은 프로세스 안의 간단한 작업 큐(동시 1~2개)에서 함. Redis 큐는 쓰지 않음.
4. 처리: ffprobe로 길이·해상도 추출 → ffmpeg로 H.264 mp4(긴 변 최대 1080, 30fps 이하, faststart, GIF도 같은 경로) → 1초 지점 썸네일 jpg → 둘 다 스토리지에 올리고 `ready`로 갱신. 실패하면 `failed`와 `error` 기록, 임시 파일 정리.
5. `GET /videos`에 status 포함, `GET /videos/:id`, `DELETE /videos/:id`(게시된 프로그램 스냅샷이 아니라 작업 중 프로그램에서 쓰는 영상이면 409로 막음).
6. 관리자 `/videos` 화면: 업로드(드래그 앤 드롭), 목록(썸네일, 이름, 길이, 해상도, 상태), 처리 중이면 몇 초마다 새로고침, 미리보기 재생, 삭제, URL 등록도 이 화면에서.
7. 빌더의 영상 선택은 `ready`인 영상만 보이게.

## Done criteria and tests to run
- `@mvn/shared` 테스트, admin/api tsc 통과.
- ffmpeg 명령 인자를 만드는 함수에 단위 테스트 1~2개(GIF 입력, 세로 영상 입력).
- ffmpeg가 없으면 `brew install ffmpeg`로 설치. 설치가 안 되면 처리 단계는 `failed`와 명확한 오류 메시지로 끝나게 하고 보고.
- 가능하면 LocalStack을 백그라운드로 띄우고 짧은 샘플(ffmpeg testsrc로 3초 생성)로 업로드→ready까지 한 번 확인한 뒤 서버를 종료. 안 되면 이유를 보고.

## Constraints
- 이 작업만, 관련 없는 리팩터링 금지
- 관련 테스트·컴파일 확인만 실행
- 커밋·푸시·배포 금지(커밋·푸시는 봇이 함)
- 끝나지 않는 서버를 포그라운드로 실행 금지, 백그라운드로 띄웠으면 반드시 종료
- `.env` 읽기·수정 금지, `.env.example`엔 로컬 값만
- 같은 오류가 두 번 반복되면 멈추고 원인과 선택지 보고

## Report back
변경 파일 요약, 테스트 결과, 로컬 확인 방법, 남은 문제(짧게)
