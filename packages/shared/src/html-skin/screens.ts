import type { ProgramItem, SkinScreenSnapshot, Step } from "../program";

function isGroup(item: ProgramItem): item is Extract<ProgramItem, { type: "group" }> {
  return (item as { type?: string }).type === "group";
}

function walkSteps(items: ProgramItem[], visit: (step: Step) => void): void {
  for (const item of items) {
    if (isGroup(item)) {
      for (const step of item.steps) visit(step);
    } else {
      visit(item);
    }
  }
}

/** draft items에서 참조된 screenId 목록 (중복 제거) */
export function collectScreenIds(items: ProgramItem[]): string[] {
  const ids = new Set<string>();
  walkSteps(items, (step) => {
    if (step.screenId) ids.add(step.screenId);
  });
  return [...ids];
}

export function pickFallbackVideoScreen(screens: SkinScreenSnapshot[]): SkinScreenSnapshot | null {
  return screens.find((s) => s.hasVideoSlot && !s.titleOnly) ?? screens.find((s) => s.hasVideoSlot) ?? screens[0] ?? null;
}

export function resolveStepScreen(
  screenId: string | undefined,
  screens: Record<string, SkinScreenSnapshot>,
  ordered: SkinScreenSnapshot[],
): SkinScreenSnapshot | null {
  if (screenId && screens[screenId]) return screens[screenId];
  return pickFallbackVideoScreen(ordered);
}