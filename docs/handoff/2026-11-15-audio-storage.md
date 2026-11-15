# 오디오 저장 정리 (스토리지 이전, 삭제 보호, 재게시 표시, 휴식 음성)

## Goal
오디오 라이브러리를 영상과 같은 S3 호환 스토리지(운영 R2, 개발 LocalStack)로 옮기고, 사용 중 삭제를 막고, 재게시가 필요한 프로그램을 표시하고, 휴식 30초·60초 음성을 연결한다.

## Context / decisions already made
- 오디오: AudioAsset(배경음악), VoicePack(카운트다운 5~1, 휴식 시작 등). 스킨 옵션은 musicId/voicePackId. 게시 스냅샷에 해석된 오디오 URL이 들어감. 변경은 재게시 때만 반영(정책 B).
- 기본 오디오(무음 MP3 배경음악 등)는 `apps/admin/public/skins/neon-arcade/audio/`에 있음.
- 영상 쪽 `apps/api/src/storage.service.ts`가 이미 있음. 같은 서비스를 재사용.

## Relevant files
- `apps/api/src/audio.controller.ts`, `apps/api/src/voice-packs.controller.ts`, `apps/api/src/audio-resolve.ts`, `apps/api/src/storage.service.ts`
- `apps/admin/app/(console)/audio/`
- `apps/admin/public/skins/neon-arcade/player.js`
- `packages/shared/src/audio.ts`

## Next steps
1. 오디오 업로드를 로컬 디스크 대신 storage.service로 저장(키 `audio/<id>.<ext>`). 기존 로컬 파일 처리는 개발용 마이그레이션 스크립트 또는 seed 갱신으로 정리.
2. 삭제 보호: 작업 중 프로그램이나 최신 게시 버전에서 쓰는 오디오·음성 팩은 409와 사용 중인 프로그램 이름 목록으로 막음. 관리자 화면에 사용 중 표시.
3. 재게시 필요 표시: 프로그램의 작업본이 최신 게시본과 다르면(내용·스킨 옵션·오디오 선택) 프로그램 목록과 빌더에 '재게시 필요' 배지.
4. 휴식 음성: 휴식 스텝 길이에 맞춰 rest_10/rest_30/rest_60 중 가까운 음성을 재생(음성 팩에 있을 때만). 관리자 음성 팩 화면에서 세 슬롯 업로드 가능하게.
5. `scripts/e2e-smoke.mjs`에 오디오 업로드 1건과 사용 중 삭제 409 확인을 추가.

## Done criteria and tests to run
- shared·api 테스트, admin/api tsc 통과.
- `pnpm infra:up` 상태에서 `pnpm dev` 백그라운드 실행 후 `pnpm e2e` 통과, 끝나면 서버 종료.

## Constraints
- main 작업 폴더에서 바로 작업, 새 브랜치·PR 금지
- 이 작업만, 관련 없는 리팩터링 금지
- 커밋·푸시 금지(봇이 함)
- 끝나지 않는 서버는 백그라운드로만, 끝나면 종료
- `.env` 읽기·수정 금지
- 같은 오류 두 번 반복 시 멈추고 원인과 선택지 보고

## Report back
변경 요약, 테스트 결과, 남은 문제(짧게)
