/** 빌더 dirty 비교용 step 필드 (UI 전용 필드 제외). */
export type BuilderDirtyStep = {
  kind: string;
  label: string;
  subtitle: string | null;
  seconds: number;
  repeatCount?: number;
  videoId: string | null;
  screenId: string | null;
  groupKey: string | null;
  groupLabel: string | null;
  groupRepeat: number | null;
};

export function stripStaleBuilderStepVideoIds<
  T extends Pick<BuilderDirtyStep, "videoId" | "screenId">,
>(stepList: T[], screens: Array<{ id: string; hasVideoSlot: boolean }>): T[] {
  return stepList.map((step) => {
    if (!step.videoId?.trim() || !step.screenId?.trim()) return step;
    const screen = screens.find((s) => s.id === step.screenId);
    if (screen && !screen.hasVideoSlot) return { ...step, videoId: null };
    return step;
  });
}

export function normalizeBuilderDirtySteps<
  T extends BuilderDirtyStep & { durationUserEdited?: boolean },
>(stepList: T[]): BuilderDirtyStep[] {
  return stepList.map(
    ({
      kind,
      label,
      subtitle,
      seconds,
      repeatCount,
      videoId,
      screenId,
      groupKey,
      groupLabel,
      groupRepeat,
    }) => ({
      kind,
      label,
      subtitle,
      seconds,
      repeatCount,
      videoId,
      screenId,
      groupKey,
      groupLabel,
      groupRepeat,
    }),
  );
}

export function builderDraftSnapshotKey(
  name: string,
  skinSlug: string,
  skinOpts: Record<string, unknown>,
  stepList: BuilderDirtyStep[],
): string {
  return JSON.stringify({ name, skin: { id: skinSlug, options: skinOpts }, steps: stepList });
}