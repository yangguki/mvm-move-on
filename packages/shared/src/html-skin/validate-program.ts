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

/** html 스킨 프로그램 스텝 규칙 (screenId·영상 슬롯·videoId) */
export function validateHtmlProgramSteps(items: ProgramItem[], screens: HtmlSkinScreenRef[]): void {
  const byId = new Map(screens.map((screen) => [screen.id, screen]));
  walkSteps(items, (step, path) => {
    if (!step.screenId?.trim()) throw new Error(`${path}.screenId가 필요해요`);
    const screen = byId.get(step.screenId);
    if (!screen) throw new Error(`${path}.screenId가 이 스킨의 화면이 아니에요`);
    if (screen.hasVideoSlot && !step.videoId?.trim()) {
      throw new Error(`${path}.videoId가 필요해요 (영상 슬롯 화면)`);
    }
    if (!screen.hasVideoSlot && step.videoId?.trim()) {
      throw new Error(`${path}는 영상 슬롯이 없는 화면이라 videoId를 넣을 수 없어요`);
    }
  });
}