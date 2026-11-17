# HTML 스킨 1단계 (1-1 ~ 1-3): 데이터 → 관리자 편집기/미리보기 → 플레이어 렌더러

## 규칙
- main에서 작업. 커밋·푸시·PR·새 브랜치 금지. .env 읽기·수정 금지.
- 종료되지 않는 서버는 백그라운드로 실행하고 끝나면 종료. 사용자의 pnpm dev(3000/3001/3002)는 종료하지 말 것.
- 실제 지점·기존 스킨 데이터 삭제 금지. 관련 없는 리팩터링 금지.
- 같은 오류가 두 번 반복되면 멈추고 원인과 선택지를 보고.

## 배경
스킨을 '화면 목록'으로 바꾼다. 스킨 = 제목 + 여러 화면. 화면은 모양별로 한 번 만들어 여러 단계에서 재사용(예: 웜업 화면 1개를 웜업 8단계에). 기본 레이아웃 없음.
기존 토큰 스킨 5종(neon-arcade 등)과 기존 플레이어 엔진은 이번에 건드리지 말고 그대로 동작해야 함(나중에 이전). 기존 테스트 프로그램 자동 변환 안 함.

## 1-1 데이터 (Prisma + 마이그레이션, 로컬 적용)
- 스킨에 kind = 'tokens' | 'html' 추가(기존은 tokens). html 스킨은 제목만 필수.
- SkinScreen: id, skinId, title, html, css, hasVideoSlot, hasNextVideoSlot, titleOnly, sortOrder, version(저장 시 증가), updatedAt. html+css 합 200KB 제한(API 검증).
- 프로그램 단계에 screenId(선택), videoId(선택), durationSec 추가(빌더 UI는 다음 작업, 이번엔 데이터·API·스냅샷만).
- 발행 스냅샷: html 스킨 프로그램은 사용한 화면의 html/css/플래그/version을 스냅샷에 복사(정책 B: 화면 수정은 재발행 시에만 반영, needsRepublish 표시). packages/shared 타입/검증 갱신 + 테스트.

## 1-2 관리자
- 스킨 목록에서 html 스킨 등록(제목). 상세에 '화면 추가' 버튼, 화면 목록(제목, 플래그, 수정/삭제/순서).
- 화면 편집: 제목, 플래그 3개, HTML/CSS 편집기(가벼운 라이브러리 또는 textarea), 오른쪽에 1920x1080 비율 미리보기(샘플 데이터로 토큰 치환, 영상 자리는 샘플 영상/회색 박스). 미리보기도 플레이어와 같은 sandbox 렌더러 사용. 사용 가능한 토큰 목록을 편집기 옆에 표시.

## 1-3 플레이어 렌더러 (apps/player, ES2017)
- 보안: 사용자 JS 금지. 저장 시와 렌더 시 모두 <script>, on* 속성, javascript: URL, iframe/object/embed/form, meta refresh 제거(서버 검증 + 렌더러 sanitize).
- iframe sandbox="allow-scripts"(allow-same-origin 금지), srcdoc에 CSP meta: default-src 'none'; script-src 'nonce-런타임'; style-src 'unsafe-inline' + 폰트 출처; img/font/media는 우리 API/미디어 출처와 data:만. 런타임 스크립트(nonce)는 우리가 넣는 것만.
- 토큰: 부모가 postMessage로 값 전달, 런타임이 textContent로 치환(항상 텍스트 이스케이프). 속성은 허용 목록만(src, 색 값 등).
  토큰: {{label}} {{remainingSec}} {{totalSec}} {{next.label}} {{next.afterRest}} {{round}} {{roundTotal}} {{stepIndex}} {{stepTotal}} {{program.name}} {{logoUrl}} {{pointColor}}. packages/shared 한 곳에 정의해 관리자·플레이어 공유.
- 영상: 화면 HTML의 data-mvn-video / data-mvn-next-video 요소로 자리만 표시. 런타임이 그 요소 rect를 부모에 postMessage, 부모가 그 위치에 실제 <video> 배치(영상은 iframe 아래 레이어, iframe 배경 투명). 다음 영상 자리는 다음 단계 영상을 음소거 루프. 연결 영상 단일 재생 방식 유지.
- 화면 없는 단계는 같은 스킨의 영상 자리 있는 첫 화면으로 대체, 렌더 오류·타임아웃 시 최소 내장 화면(라벨+남은 시간+영상)으로 폴백.
- 스냅샷 스킨 kind가 html이면 새 렌더러, tokens면 기존 엔진.

## 테스트
- packages/shared, apps/api npm test(새 검증/스냅샷/sanitize 테스트 추가), admin·api·player 타입체크.
- 샘플 html 스킨 1개(화면 2개: 영상 있는 운동 화면, 타이틀 전용 화면)를 시드나 스크립트로 만들고, puppeteer로 관리자 미리보기 스크린샷을 docs/skins/html-preview-*.png로 저장.
- e2e는 사용자 3001을 건드리지 말고 별도 포트(PORT=3011, 백그라운드, 끝나면 종료)에서 `API=http://localhost:3011 node scripts/e2e-smoke.mjs`.

## 보고
바꾼 파일, 테스트 결과, 스크린샷 경로, 남은 문제를 짧게.
