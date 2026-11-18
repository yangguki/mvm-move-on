/**
 * iPT POWER BELL 샘플 프로그램 74-step 빌더 (DB 비의존).
 * README "74 steps" 순서: intro → warm-up → wait/preview → 8 exercise blocks → cool-down → completed.
 */

const EXERCISE_NAMES = ["1번 운동 동작", "2번 운동 동작", "3번 운동 동작", "4번 운동 동작"];
const SET_TOTAL = 3;

/** @typedef {{ intro: string, 'warmup-title': string, warmup: string, 'workout-wait': string, preview: string, exercise: string, rest: string, change: string, 'change-preview': string, 'cooldown-title': string, cooldown: string, completed: string }} ScreenIdMap */

/**
 * @param {{ screenIds: ScreenIdMap, videoId: string }} opts
 * @returns {Array<{ id: string, type: string, durationSec: number, screenId: string, label?: string, videoId?: string, text?: string }>}
 */
export function buildIptPowerBellSampleSteps({ screenIds, videoId }) {
  const steps = [];
  /** 관리자 빌더 `toSharedProgram`과 동일한 step-${index} id — 시드 후 자동저장 시 id만 바뀌어 재게시 필요로 뜨지 않게. */
  const push = (partial) => {
    steps.push({ id: `step-${steps.length}`, ...partial });
  };

  push({ type: "guide", durationSec: 5, screenId: screenIds.intro, label: "POWER BELL" });
  push({ type: "guide", durationSec: 5, screenId: screenIds["warmup-title"], label: "WARM UP" });

  for (let i = 1; i <= 8; i += 1) {
    push({
      type: "exercise",
      durationSec: 30,
      screenId: screenIds.warmup,
      label: `웜업 ${i}`,
      videoId,
    });
  }

  push({
    type: "guide",
    durationSec: 20,
    screenId: screenIds["workout-wait"],
    label: "운동 시작 전 대기",
    videoId,
  });
  push({
    type: "guide",
    durationSec: 10,
    screenId: screenIds.preview,
    label: EXERCISE_NAMES[0],
  });

  // 8 blocks: ex1, ex1, ex2, ex2, ex3, ex3, ex4, ex4
  const blockOrder = [0, 0, 1, 1, 2, 2, 3, 3];
  blockOrder.forEach((exIndex, blockIndex) => {
    const name = EXERCISE_NAMES[exIndex];
    for (let set = 1; set <= SET_TOTAL; set += 1) {
      push({
        type: "exercise",
        durationSec: 45,
        screenId: screenIds.exercise,
        label: name,
        videoId,
        text: `set=${set}/${SET_TOTAL}`,
      });
      if (set < SET_TOTAL) {
        push({
          type: "rest",
          durationSec: 15,
          screenId: screenIds.rest,
          label: "휴식",
        });
      }
    }
    if (blockIndex < blockOrder.length - 1) {
      push({
        type: "guide",
        durationSec: 20,
        screenId: screenIds.change,
        label: "CHANGE",
      });
      push({
        type: "guide",
        durationSec: 10,
        screenId: screenIds["change-preview"],
        label: EXERCISE_NAMES[blockOrder[blockIndex + 1]],
      });
    }
  });

  push({
    type: "guide",
    durationSec: 15,
    screenId: screenIds["cooldown-title"],
    label: "COOL DOWN",
  });
  for (let i = 1; i <= 6; i += 1) {
    push({
      type: "exercise",
      durationSec: 30,
      screenId: screenIds.cooldown,
      label: `쿨다운 ${i}`,
      videoId,
    });
  }
  push({ type: "guide", durationSec: 10, screenId: screenIds.completed, label: "COMPLETED" });

  return steps;
}

/** 화면 slug별 기대 스텝 수 */
export const IPT_POWER_BELL_SAMPLE_SCREEN_COUNTS = {
  intro: 1,
  "warmup-title": 1,
  warmup: 8,
  "workout-wait": 1,
  preview: 1,
  exercise: 24,
  rest: 16,
  change: 7,
  "change-preview": 7,
  "cooldown-title": 1,
  cooldown: 6,
  completed: 1,
};

export const IPT_POWER_BELL_SAMPLE_STEP_COUNT = 74;

/** @param {Array<{ durationSec: number }>} steps */
export function totalDurationSec(steps) {
  return steps.reduce((sum, step) => sum + step.durationSec, 0);
}

export const IPT_POWER_BELL_SAMPLE_TOTAL_DURATION_SEC =
  5 + 5 + 8 * 30 + 20 + 10 + 8 * (45 + 15 + 45 + 15 + 45) + 7 * (20 + 10) + 15 + 6 * 30 + 10;
