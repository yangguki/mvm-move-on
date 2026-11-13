# 프로그램 스키마

서버·관리자·플레이어가 같은 계약을 쓰도록 `@mvn/shared`의 타입과 `expand`를 기준으로 합니다.

## Program

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 프로그램 ID |
| `name` | string | 표시 이름 |
| `status` | `'draft' \| 'published'` | 초안 / 게시됨 |
| `draftUpdatedAt` | string (ISO) | 초안 마지막 수정 시각 |
| `publishedVersion` | number \| null | 게시된 버전. 없으면 null |
| `skin` | ProgramSkin | 지금은 `neon-arcade`만 |
| `items` | `Array<Step \| Group>` | 편집 순서(그룹은 접힌 상태) |

### ProgramSkin

```ts
{
  id: "neon-arcade",
  options: {
    pointColor: string,
    logoUrl?: string,
    restImageUrl?: string,
    musicUrl?: string,
    nextLeadSec: number // 기본 10. 종료 N초 전 NEXT 노출
  }
}
```

## Step

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 스텝 ID |
| `type` | `'exercise' \| 'rest' \| 'guide'` | 운동 / 휴식 / 안내 |
| `durationSec` | number | 재생 시간(초) |
| `videoId?` | string | 운동 영상 ID |
| `label?` | string | TV 표시 이름. 없으면 영상 이름 |
| `text?` | string | 안내 문구 등 |

## Group

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 그룹 ID |
| `type` | `'group'` | 고정 |
| `repeat` | number (≥ 2) | 반복 횟수. 중첩 그룹 없음 |
| `steps` | Step[] | 한 바퀴 스텝 |

## Video

| 필드 | 타입 |
| --- | --- |
| `id` | string |
| `name` | string |
| `url` | string |
| `durationSec` | number |
| `thumbnailUrl` | string |
| `width` | number |
| `height` | number |

영상은 원본 1회 클립입니다. 플레이어가 두 버퍼를 번갈아 쓰며 `durationSec` 동안 반복합니다.

## ProgramVersion

게시 시점 스냅샷입니다. 한 번 저장되면 바뀌지 않습니다.

```ts
{
  programId: string,
  version: number,
  publishedAt: string,
  snapshot: Program
}
```

초안 저장 → 게시(v1) → 수정 → 재게시(v2). 매장·TV에는 게시된 버전만 반영됩니다.

## expand(program)

`packages/shared/src/program.ts`의 순수 함수입니다. 그룹을 `repeat`만큼 펼쳐 `PlayItem[]`을 반환합니다.

```ts
PlayItem {
  index: number
  stepId: string
  type: StepType
  durationSec: number
  video?: Video
  label: string
  next?: { label: string, video?: Video, afterRest: boolean }
}
```

### NEXT 규칙

- NEXT는 입력하지 않고 다음 **운동**에서 자동 생성합니다.
- 다음 운동 앞에 휴식이 있으면 `label`은 `휴식 후 · {다음 운동}`, `afterRest: true`.
- 휴식 스텝의 `next`는 바로 이어질 다음 운동을 보여 줍니다(`afterRest: false`).

### 예시

그룹 ×3: 덤벨 숄더 프레스 20초, 얼터네이트 숄더 프레스 20초, 휴식 10초

- 펼친 항목 수: **9**
- 총 시간: **150초**
- 1번째 NEXT: `얼터네이트 숄더 프레스`
- 2번째 NEXT: `휴식 후 · 덤벨 숄더 프레스`

## 미리보기 메시지

관리자 빌더 → 스킨 iframe:

```ts
iframe.contentWindow.postMessage(
  { type: "mvn:program", program: { ...program, playItems: expand(program) } },
  "*"
)
```

스킨 파일 경로: `/skins/neon-arcade/index.html` (없으면 내장 미리보기 이미지 사용)

## 관리자 API와의 관계

현재 Nest API는 플랫 `steps[]` + `groupKey` / `groupLabel` / `groupRepeat`와 `countdown|exercise|rest`를 씁니다. 빌더는 API 형식을 유지한 채, 미리보기·타임라인용으로 `@mvn/shared` Program으로 변환한 뒤 `expand`합니다. `countdown`은 shared의 `guide`에 대응합니다.
