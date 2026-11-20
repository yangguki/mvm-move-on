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

function walkSteps(items: ProgramItem[], visit: (step: Step, path: string) => void): void {
  items.forEach((item, index) => {
    if (isGroup(item)) {
      item.steps.forEach((step, stepIndex) => visit(step, `items[${index}].steps[${stepIndex}]`));
      return;
    }
    visit(item, `items[${index}]`);
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
  let stepNumber = 0;
  walkSteps(items, (step) => {
    stepNumber += 1;
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
  let stepNumber = 0;
  walkSteps(items, (step) => {
    stepNumber += 1;
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
  walkSteps(items, (step, path) => {
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
      throw new Error(`${path}는 영상 슬롯이 없는 화면이라 videoId를 넣을 수 없어요`);
    }
  });
}