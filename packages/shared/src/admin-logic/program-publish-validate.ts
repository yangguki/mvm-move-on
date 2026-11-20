import type { ProgramItem, Step } from "../program";

export type PublishScreenRef = { id: string; hasVideoSlot: boolean };

export type MissingVideoStep = {
  stepNumber: number;
  label: string;
};

function isGroup(item: ProgramItem): item is Extract<ProgramItem, { type: "group" }> {
  return (item as { type?: string }).type === "group";
}

function stepNeedsVideo(
  step: Step,
  opts: { skinKind: string; screensById: Map<string, PublishScreenRef> },
): boolean {
  if (opts.skinKind === "html") {
    if (!step.screenId) return false;
    return !!opts.screensById.get(step.screenId)?.hasVideoSlot;
  }
  return step.type === "exercise";
}

/** 발행 전: 영상 슬롯(토큰=exercise / HTML=hasVideoSlot)에 videoId가 없는 단계 */
export function collectMissingPublishVideos(
  items: ProgramItem[],
  opts: { skinKind: string; screens?: PublishScreenRef[] },
): MissingVideoStep[] {
  const screensById = new Map((opts.screens ?? []).map((screen) => [screen.id, screen]));
  const missing: MissingVideoStep[] = [];
  let stepNumber = 0;

  const visit = (step: Step) => {
    stepNumber += 1;
    if (!stepNeedsVideo(step, { skinKind: opts.skinKind, screensById })) return;
    if (step.videoId?.trim()) return;
    missing.push({
      stepNumber,
      label: step.label?.trim() || `${stepNumber}단계`,
    });
  };

  for (const item of items) {
    if (isGroup(item)) {
      item.steps.forEach(visit);
      continue;
    }
    visit(item);
  }
  return missing;
}

export function missingPublishVideosMessage(missing: MissingVideoStep[]): string | null {
  if (!missing.length) return null;
  const detail = missing.map((step) => `${step.stepNumber}단계 "${step.label}"`).join(", ");
  return `영상이 필요한 단계에 영상이 없어요: ${detail}`;
}