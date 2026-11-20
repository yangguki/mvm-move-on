export const STEP_DURATION_SEC_MIN = 1;
export const STEP_DURATION_SEC_MAX = 3600;

export const STEP_REPEAT_COUNT_MIN = 1;
export const STEP_REPEAT_COUNT_MAX = 99;

export function clampStepDurationSec(sec: number): number {
  const n = Math.floor(sec);
  if (!Number.isFinite(n)) return STEP_DURATION_SEC_MIN;
  return Math.min(STEP_DURATION_SEC_MAX, Math.max(STEP_DURATION_SEC_MIN, n));
}

export function clampRepeatCount(count: number): number {
  const n = Math.floor(count);
  if (!Number.isFinite(n)) return STEP_REPEAT_COUNT_MIN;
  return Math.min(STEP_REPEAT_COUNT_MAX, Math.max(STEP_REPEAT_COUNT_MIN, n));
}

/** 영상 운동 단계 총 시간 = 영상 길이 × 반복 횟수 */
export function computeVideoStepDurationSec(repeatCount: number, videoDurationSec: number): number {
  const video = Math.floor(videoDurationSec);
  if (!Number.isFinite(video) || video <= 0) return clampStepDurationSec(repeatCount);
  return clampStepDurationSec(clampRepeatCount(repeatCount) * video);
}

export function resolveDefaultVideoStepRepeatCount(input: {
  screenDefaultDurationSec?: number | null;
  videoDurationSec?: number | null;
}): number {
  const video = input.videoDurationSec;
  if (video == null || !Number.isFinite(video) || video <= 0) return STEP_REPEAT_COUNT_MIN;
  const screen = input.screenDefaultDurationSec;
  if (screen != null && Number.isFinite(screen) && screen > 0) {
    return clampRepeatCount(Math.round(screen / video));
  }
  return STEP_REPEAT_COUNT_MIN;
}

export function inferVideoStepRepeatCount(input: {
  repeatCount?: number | null;
  durationSec: number;
  videoDurationSec?: number | null;
}): number {
  if (input.repeatCount != null && Number.isFinite(input.repeatCount) && input.repeatCount > 0) {
    return clampRepeatCount(input.repeatCount);
  }
  const video = input.videoDurationSec;
  if (video != null && Number.isFinite(video) && video > 0) {
    return clampRepeatCount(Math.round(input.durationSec / video));
  }
  return STEP_REPEAT_COUNT_MIN;
}

export type ResolveVideoStepDurationInput = {
  screenDefaultDurationSec?: number | null;
  videoDurationSec?: number | null;
  fallbackSec?: number;
};

/** 영상 길이를 모를 때 단계 시간(직접 입력) 폴백: 화면 기본 > fallback */
export function resolveVideoStepDurationSec(input: ResolveVideoStepDurationInput): number {
  const fallback = input.fallbackSec ?? 45;
  const screen = input.screenDefaultDurationSec;
  if (screen != null && Number.isFinite(screen) && screen > 0) {
    return clampStepDurationSec(screen);
  }
  const video = input.videoDurationSec;
  if (video != null && Number.isFinite(video) && video > 0) {
    return clampStepDurationSec(video);
  }
  return clampStepDurationSec(fallback);
}

export type StepDurationScreenChangeReason = "user_picked_screen" | "auto_assign_screen";

export type ResolveStepDurationOnScreenChangeInput = {
  reason: StepDurationScreenChangeReason;
  currentDurationSec: number;
  currentRepeatCount?: number | null;
  /** 반복 횟수(또는 시간)를 사용자가 직접 바꾼 뒤에는 auto_assign에서 덮어쓰지 않음 */
  durationUserEdited?: boolean;
  screenDefaultDurationSec?: number | null;
  hasVideoSlot?: boolean;
  videoDurationSec?: number | null;
  fallbackSec?: number;
};

export type VideoStepTiming = { repeatCount: number; durationSec: number };

function durationFromScreenDefault(input: ResolveStepDurationOnScreenChangeInput): number | null {
  const fallback = input.fallbackSec ?? 45;
  if (input.hasVideoSlot) {
    return resolveVideoStepDurationSec({
      screenDefaultDurationSec: input.screenDefaultDurationSec,
      videoDurationSec: input.videoDurationSec,
      fallbackSec: fallback,
    });
  }
  const screen = input.screenDefaultDurationSec;
  if (screen != null && Number.isFinite(screen) && screen > 0) {
    return clampStepDurationSec(screen);
  }
  return null;
}

/** 화면 선택/자동 배정 시 비-영상·영상길이 미상 단계 시간 */
export function resolveStepDurationOnScreenChange(input: ResolveStepDurationOnScreenChangeInput): number {
  const fromScreen = durationFromScreenDefault(input);

  if (input.reason === "user_picked_screen") {
    return fromScreen ?? clampStepDurationSec(input.currentDurationSec);
  }
  if (input.durationUserEdited) {
    return clampStepDurationSec(input.currentDurationSec);
  }
  return fromScreen ?? clampStepDurationSec(input.currentDurationSec);
}

/** 영상 길이를 아는 영상 슬롯 단계: 반복 횟수와 총 시간 */
export function resolveVideoStepTimingOnScreenChange(input: ResolveStepDurationOnScreenChangeInput): VideoStepTiming {
  const video = input.videoDurationSec;
  const hasVideoLen = input.hasVideoSlot && video != null && Number.isFinite(video) && video > 0;
  if (!hasVideoLen) {
    return {
      repeatCount: STEP_REPEAT_COUNT_MIN,
      durationSec: resolveStepDurationOnScreenChange(input),
    };
  }
  if (input.reason === "user_picked_screen") {
    const repeatCount = resolveDefaultVideoStepRepeatCount({
      screenDefaultDurationSec: input.screenDefaultDurationSec,
      videoDurationSec: video,
    });
    return { repeatCount, durationSec: computeVideoStepDurationSec(repeatCount, video) };
  }
  if (input.durationUserEdited) {
    const repeatCount = inferVideoStepRepeatCount({
      repeatCount: input.currentRepeatCount,
      durationSec: input.currentDurationSec,
      videoDurationSec: video,
    });
    return { repeatCount, durationSec: computeVideoStepDurationSec(repeatCount, video) };
  }
  const repeatCount = resolveDefaultVideoStepRepeatCount({
    screenDefaultDurationSec: input.screenDefaultDurationSec,
    videoDurationSec: video,
  });
  return { repeatCount, durationSec: computeVideoStepDurationSec(repeatCount, video) };
}

export function resolveVideoStepTiming(input: {
  repeatCount?: number | null;
  durationSec: number;
  videoDurationSec?: number | null;
  hasVideoSlot?: boolean;
}): VideoStepTiming {
  const video = input.videoDurationSec;
  if (input.hasVideoSlot && video != null && Number.isFinite(video) && video > 0) {
    const repeatCount = inferVideoStepRepeatCount({
      repeatCount: input.repeatCount,
      durationSec: input.durationSec,
      videoDurationSec: video,
    });
    return { repeatCount, durationSec: computeVideoStepDurationSec(repeatCount, video) };
  }
  return { repeatCount: STEP_REPEAT_COUNT_MIN, durationSec: clampStepDurationSec(input.durationSec) };
}