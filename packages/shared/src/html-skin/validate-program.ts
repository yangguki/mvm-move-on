import type { ProgramItem, Step } from "../program";

export type HtmlSkinScreenRef = {
  id: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
};

function isGroup(item: ProgramItem): item is Extract<ProgramItem, { type: "group" }> {
  return (item as { type?: string }).type === "group";
}

function walkSteps(
  items: ProgramItem[],
  visit: (step: Step, path: string, stepNumber: number) => void,
): void {
  let stepNumber = 0;
  items.forEach((item, index) => {
    if (isGroup(item)) {
      item.steps.forEach((step, stepIndex) => {
        stepNumber += 1;
        visit(step, `items[${index}].steps[${stepIndex}]`, stepNumber);
      });
      return;
    }
    stepNumber += 1;
    visit(item, `items[${index}]`, stepNumber);
  });
}

function stripStepVideoIdIfNoSlot(step: Step, byId: Map<string, HtmlSkinScreenRef>): Step {
  const screenId = step.screenId?.trim();
  if (!screenId) return step;
  const screen = byId.get(screenId);
  if (!screen?.hasVideoSlot && step.videoId?.trim()) {
    const { videoId: _drop, ...rest } = step;
    return rest as Step;
  }
  return step;
}

/** 영상 슬롯 없는 html 화면에 남은 videoId 제거 (draft 저장·로드 정리용) */
export function stripStaleHtmlProgramVideoIds(
  items: ProgramItem[],
  screens: HtmlSkinScreenRef[],
): ProgramItem[] {
  const byId = new Map(screens.map((screen) => [screen.id, screen]));
  return items.map((item) => {
    if (isGroup(item)) {
      const steps = item.steps.map((step) => stripStepVideoIdIfNoSlot(step, byId));
      const changed = steps.some((step, index) => step !== item.steps[index]);
      return changed ? { ...item, steps } : item;
    }
    const next = stripStepVideoIdIfNoSlot(item, byId);
    return next !== item ? next : item;
  });
}

export type ValidateHtmlProgramStepsMode = "draft" | "publish";

export type MissingHtmlScreenStep = {
  stepNumber: number;
};

/** 발행 전: 스킨에 없는 screenId를 가리키는 단계 */
export function collectMissingHtmlProgramScreens(
  items: ProgramItem[],
  screens: HtmlSkinScreenRef[],
): MissingHtmlScreenStep[] {
  const byId = new Map(screens.map((screen) => [screen.id, screen]));
  const missing: MissingHtmlScreenStep[] = [];
  walkSteps(items, (step, _path, stepNumber) => {
    const screenId = step.screenId?.trim();
    if (!screenId) return;
    if (!byId.has(screenId)) missing.push({ stepNumber });
  });
  return missing;
}

export function missingPublishScreensMessage(missing: MissingHtmlScreenStep[]): string | null {
  if (!missing.length) return null;
  const numbers = missing.map((step) => step.stepNumber).join(", ");
  return `삭제된 화면을 쓰는 단계가 있어요: ${numbers}단계. 다른 화면을 골라 주세요.`;
}

export type MissingHtmlVideoStep = {
  stepNumber: number;
  label?: string;
};

/** 발행 전: 영상 슬롯 화면인데 videoId가 없는 단계 */
export function collectMissingHtmlProgramVideos(
  items: ProgramItem[],
  screens: HtmlSkinScreenRef[],
): MissingHtmlVideoStep[] {
  const byId = new Map(screens.map((screen) => [screen.id, screen]));
  const missing: MissingHtmlVideoStep[] = [];
  walkSteps(items, (step, _path, stepNumber) => {
    const screenId = step.screenId?.trim();
    if (!screenId) return;
    const screen = byId.get(screenId);
    if (!screen?.hasVideoSlot) return;
    if (step.videoId?.trim()) return;
    const label = step.label?.trim();
    missing.push(label ? { stepNumber, label } : { stepNumber });
  });
  return missing;
}

export function missingPublishHtmlVideosMessage(missing: MissingHtmlVideoStep[]): string | null {
  if (!missing.length) return null;
  const detail = missing
    .map((step) => `${step.stepNumber}단계 "${step.label?.trim() || `${step.stepNumber}단계`}"`)
    .join(", ");
  return `영상이 필요한 단계에 영상이 없어요: ${detail}`;
}

/** html 스킨 프로그램 스텝 규칙 (screenId·영상 슬롯·videoId) */
export function validateHtmlProgramSteps(
  items: ProgramItem[],
  screens: HtmlSkinScreenRef[],
  mode: ValidateHtmlProgramStepsMode = "publish",
): void {
  const byId = new Map(screens.map((screen) => [screen.id, screen]));
  walkSteps(items, (step, path, stepNumber) => {
    if (!step.screenId?.trim()) throw new Error(`${path}.screenId가 필요해요`);
    const screen = byId.get(step.screenId);
    if (!screen) {
      if (mode === "draft") return;
      throw new Error(`${path}.screenId가 이 스킨의 화면이 아니에요`);
    }
    if (screen.hasVideoSlot && !step.videoId?.trim()) {
      if (mode === "draft") return;
      throw new Error(`${path}.videoId가 필요해요 (영상 슬롯 화면)`);
    }
    if (!screen.hasVideoSlot && step.videoId?.trim()) {
      const label = step.label?.trim();
      const where = label ? `${stepNumber}단계 "${label}"` : `${stepNumber}단계`;
      throw new Error(`${where}는 영상 슬롯이 없는 화면이라 videoId를 넣을 수 없어요`);
    }
  });
}