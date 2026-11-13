export type ProgramStatus = "draft" | "published";

export type SkinOptions = {
  pointColor: string;
  logoUrl?: string;
  restImageUrl?: string;
  /** 배경음악 AudioAsset id. 없으면 기본 음악 */
  musicId?: string;
  /** VoicePack id. 없으면 기본 음성 팩 */
  voicePackId?: string;
  nextLeadSec: number;
};

export type ResolvedAudioRef = {
  id: string;
  name: string;
  url: string;
  durationSec: number;
  mimeType?: string;
};

export type VoiceCueKey = "countdown5" | "countdown4" | "countdown3" | "countdown2" | "countdown1" | "restStart";

export type ResolvedVoicePack = {
  id: string;
  name: string;
  cues: Record<VoiceCueKey, ResolvedAudioRef>;
};

export type ProgramSkin = {
  id: "neon-arcade";
  options: SkinOptions;
  /** 게시 스냅샷에만 url까지 풀려 들어갑니다 */
  music?: ResolvedAudioRef;
  voicePack?: ResolvedVoicePack;
};

export type StepType = "exercise" | "rest" | "guide";

export type Step = {
  id: string;
  type: StepType;
  durationSec: number;
  videoId?: string;
  label?: string;
  text?: string;
};

export type Group = {
  id: string;
  type: "group";
  repeat: number;
  steps: Step[];
};

export type ProgramItem = Step | Group;

export type Video = {
  id: string;
  name: string;
  url: string;
  durationSec: number;
  thumbnailUrl: string;
  width: number;
  height: number;
};

export type Program = {
  id: string;
  name: string;
  status: ProgramStatus;
  draftUpdatedAt: string;
  publishedVersion: number | null;
  skin: ProgramSkin;
  items: ProgramItem[];
};

export type ProgramVersion = {
  programId: string;
  version: number;
  publishedAt: string;
  snapshot: Program;
};

export type PlayNext = {
  label: string;
  video?: Video;
  afterRest: boolean;
};

export type PlayItem = {
  index: number;
  stepId: string;
  type: StepType;
  durationSec: number;
  video?: Video;
  label: string;
  next?: PlayNext;
};

type FlatStep = Step & { video?: Video };

function isGroup(item: ProgramItem): item is Group {
  return item.type === "group";
}

function stepLabel(step: Step, videos: Map<string, Video>): string {
  if (step.label?.trim()) return step.label.trim();
  if (step.videoId) {
    const video = videos.get(step.videoId);
    if (video) return video.name;
  }
  if (step.type === "rest") return "휴식";
  if (step.type === "guide") return "안내";
  return "운동";
}

function flatten(program: Program, videos: Map<string, Video>): FlatStep[] {
  const flat: FlatStep[] = [];
  for (const item of program.items) {
    if (isGroup(item)) {
      const repeat = Math.max(2, Math.floor(item.repeat));
      for (let round = 0; round < repeat; round += 1) {
        for (const step of item.steps) {
          flat.push({
            ...step,
            video: step.videoId ? videos.get(step.videoId) : undefined,
          });
        }
      }
      continue;
    }
    flat.push({
      ...item,
      video: item.videoId ? videos.get(item.videoId) : undefined,
    });
  }
  return flat;
}

function findNextExercise(flat: FlatStep[], fromIndex: number): { step: FlatStep; afterRest: boolean } | null {
  let afterRest = false;
  for (let index = fromIndex + 1; index < flat.length; index += 1) {
    const step = flat[index];
    if (step.type === "rest") {
      afterRest = true;
      continue;
    }
    if (step.type === "exercise") {
      return { step, afterRest };
    }
  }
  return null;
}

function nextPayload(current: FlatStep, found: { step: FlatStep; afterRest: boolean } | null): PlayNext | undefined {
  if (!found) return undefined;
  const exerciseLabel = stepLabel(found.step, new Map());
  const label =
    current.type !== "rest" && found.afterRest ? `휴식 후 · ${exerciseLabel}` : exerciseLabel;
  return {
    label,
    video: found.step.video,
    afterRest: current.type === "rest" ? false : found.afterRest,
  };
}

/** 그룹을 repeat만큼 펼쳐 플레이 순서를 만듭니다. NEXT는 다음 운동에서 자동 생성합니다. */
export function expand(program: Program, videos: Video[] = []): PlayItem[] {
  const videoMap = new Map(videos.map((video) => [video.id, video]));
  const flat = flatten(program, videoMap);
  return flat.map((step, index) => {
    const found = findNextExercise(flat, index);
    return {
      index,
      stepId: step.id,
      type: step.type,
      durationSec: step.durationSec,
      video: step.video,
      label: stepLabel(step, videoMap),
      next: nextPayload(step, found),
    };
  });
}

export function playTotalSec(playItems: PlayItem[]): number {
  return playItems.reduce((sum, item) => sum + item.durationSec, 0);
}
