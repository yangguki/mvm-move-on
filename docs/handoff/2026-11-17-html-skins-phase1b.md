# HTML 스킨 1단계 나머지 (1-4, 1-5) — 기획서 v2.4.1 기준

이전 작업: 1-1~1-3 (commit fe5eda6, 보고서 docs/handoff/2026-11-17-html-skins-phase1a-report.md).
공통 규칙: main에서 작업. 커밋·푸시·PR·새 브랜치 금지. `.env` 읽기·수정 금지. DB(Postgres)는 이 PC에서 꺼져 있으니 DB가 필요한 명령(migrate, seed 실행, e2e)은 돌리지 말 것. 서버를 띄우면 백그라운드로 띄우고 끝나면 종료, 사용자의 3000/3001/3002 dev 서버는 건드리지 않음. 관련 없는 리팩터링 금지. 같은 오류 두 번이면 멈추고 보고서에 원인 기록.

## 1-4 (A 실행): neon-arcade를 화면 방식으로 이전 (ADM-SKN-10)
- 기존 tokens 방식 neon-arcade 테마(색·폰트·배경·텍스트 스타일)를 그대로 살려 kind='html' 스킨 neon-arcade의 화면(SkinScreen) 세트로 만든다. 고정 공용 레이아웃은 쓰지 않는다.
- 화면 10개(POWER BELL 기준, 제목 그대로): 수업 대기, 웜업 타이틀, 웜업, 운동 대기, 운동, 휴식, 체인지, 체인지 후 미리보기, 쿨다운 타이틀, 완료.
  - 타이틀 전용(영상 없음): 수업 대기, 웜업 타이틀, 운동 대기, 체인지(20초용 이동 안내 "머신 그룹은 플로어로 · 플로어 그룹은 머신으로"), 쿨다운 타이틀, 완료.
  - 영상 슬롯(data-mvn-video): 웜업, 운동.
  - 다음 영상 슬롯(data-mvn-next-video): 휴식, 체인지 후 미리보기(10초용, 다음 운동 영상 + 사용 근육 자리. 근육 인체도는 2단계라 지금은 자리만).
- 토큰은 packages/shared 정의 그대로 사용 ({{label}} {{remainingSec}} {{totalSec}} {{next.label}} {{next.afterRest}} {{round}} {{roundTotal}} {{stepIndex}} {{stepTotal}} {{program.name}} {{logoUrl}} {{pointColor}}). 기획서 v2.4.1의 {{set}}/{{setTotal}}이 shared에 없으면 토큰 정의에 추가만 하고 값은 플레이어에서 아직 빈 값이어도 됨(그룹 반복은 2단계).
- 화면 소스는 파일로 둔다(예: packages/shared 또는 packages/db/prisma 아래 neon-arcade 화면 HTML/CSS 파일). scripts/seed-html-skin.mjs가 DB가 켜졌을 때 이 파일들로 neon-arcade html 스킨+화면을 upsert하도록 갱신(기존 tokens neon-arcade 행은 삭제하지 말 것). 실행은 하지 않음.
- 각 화면이 sanitize를 통과하고 200KB 이하인지 확인하는 테스트를 packages/shared/test에 추가.
- 미리보기 스크린샷: scripts/html-preview-screenshots.mjs로 10개 화면을 docs/skins/neon-html-<화면>.png로 저장(샘플 데이터).
- 기존 tokens 스킨 4종과 tokens 엔진은 그대로 둔다.

## 1-5 (B 실행): 빌더에서 스텝별 화면·영상·시간 (ADM-PRG-02/03/16)
- 프로그램이 kind='html' 스킨을 고르면 스텝 편집에서 그 스킨의 화면 목록을 선택(Step.screenId). 같은 화면을 여러 스텝에서 재사용.
- 고른 화면이 영상 슬롯을 가진 경우에만 운동 영상 선택칸을 보여 준다. 영상을 고르면 durationSec를 영상 길이로 미리 채우고 수정 가능. 영상 길이(읽기 전용)와 durationSec를 같이 표시.
- 타이틀 전용 화면은 시간만 입력. 영상 슬롯 없는 화면으로 바꾸면 videoId를 비운다.
- 다음 영상 슬롯 화면은 별도 영상 선택 없이 다음 영상 스텝의 영상을 플레이어가 쓰는 기존 규칙 유지(1a 렌더러 확인만).
- kind='tokens' 스킨 프로그램은 기존 빌더 동작 그대로.
- 저장 검증(packages/shared validate / API): html 스킨 프로그램의 스텝은 screenId 필수, 그 스킨의 화면이어야 함, 영상 슬롯 화면은 videoId 필수, durationSec 필수(>0). 관련 단위 테스트 추가.
- 참고(2단계, 지금 하지 않음): Video.musclesFront/musclesBack, Group.skipLastRest, SkinScreen.slots JSON 정리(현재 hasVideoSlot/hasNextVideoSlot/titleOnly 유지).

## 확인 (DB 없이)
- `@mvn/shared`, `@mvn/api` 테스트, admin·api·player tsc.
- 보고서: docs/handoff/2026-11-17-html-skins-phase1b-report.md 에 A/B 각각 바뀐 파일, 테스트 결과, 남은 점을 짧게 추가.
