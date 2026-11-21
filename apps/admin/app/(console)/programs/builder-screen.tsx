"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Cast,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Coffee,
  Copy,
  Eye,
  GripVertical,
  History,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat2,
  Save,
  Send,
  SkipBack,
  SkipForward,
  Timer,
  Trash2,
  Tv,
} from "lucide-react";
import {
  buildHtmlSkinStepPreviewDocument,
  builderDraftSnapshotKey,
  clampRepeatCount,
  clampStepDurationSec,
  computeVideoStepDurationSec,
  expand,
  inferVideoStepRepeatCount,
  normalizeBuilderDirtySteps,
  stripStaleBuilderStepVideoIds,
  playTotalSec,
  resolveDefaultVideoStepRepeatCount,
  resolveVideoStepDurationSec,
  resolveVideoStepTimingOnScreenChange,
  type HtmlSkinTokenMap,
  type Program as SharedProgram,
  type ProgramItem,
  type Step as SharedStep,
  isYouTubeUrl,
  parseYouTubeVideoId,
  resolveExternalVideoThumbnail,
} from "@mvn/shared";
import { ApiError, api } from "@/lib/api";
import { isCloudDataMode } from "@/lib/data-mode";
import { fetchYouTubeDurationSec } from "@/lib/youtube-duration";

type Kind = "countdown" | "exercise" | "rest";
type Frame = "exercise" | "next" | "rest";
type Step = {
  kind: Kind;
  label: string;
  subtitle: string | null;
  seconds: number;
  repeatCount?: number;
  videoId: string | null;
  screenId: string | null;
  durationUserEdited?: boolean;
  groupKey: string | null;
  groupLabel: string | null;
  groupRepeat: number | null;
};
type Program = SharedProgram & {
  totals?: { seconds: number; stepCount: number };
  needsRepublish?: boolean;
  rev?: number;
};
type VideoItem = { id: string; name: string; url: string; durationSec: number; thumbnailUrl: string; width: number; height: number; status?: string };
type AudioItem = { id: string; name: string; kind: string; url: string; durationSec: number; mimeType: string };
type VoicePackItem = { id: string; name: string; isDefault: boolean };
type VersionItem = { id: string; version: number; name: string; publishedAt: string; stepCount: number };
type SkinItem = { id: string; slug: string; name: string; kind?: string; tokens: Record<string, unknown>; isActive: boolean };
type SkinScreenListItem = {
  id: string;
  title: string;
  html: string;
  css: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
  defaultDurationSec?: number | null;
};

type Block =
  | { type: "single"; index: number; step: Step }
  | { type: "group"; key: string; label: string; repeat: number; indices: number[]; seconds: number };

const FRAME_SRC: Record<Frame, { src: string; alt: string; tag: string }> = {
  exercise: { src: "/media/skin-neon-exercise.jpg", alt: "운동 화면 미리보기", tag: "운동 재생" },
  next: { src: "/media/skin-neon-next.jpg", alt: "NEXT 예고 화면 미리보기", tag: "마지막 10초 · 다음 동작 예고" },
  rest: { src: "/media/skin-neon-rest.jpg", alt: "휴식 화면 미리보기", tag: "휴식" },
};

const THUMB: Record<string, string> = {
  "덤벨 숄더 프레스": "/media/thumb-shoulder-press.jpg",
  "얼터네이트 숄더 프레스": "/media/thumb-alt-press.jpg",
};

function clock(total: number) {
  const safe = Math.max(0, Math.floor(total));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function fromShared(program: SharedProgram): Step[] {
  const out: Step[] = [];
  for (const item of program.items) {
    if (item.type === "group") {
      for (const step of item.steps) {
        out.push({
          kind: step.type === "guide" ? "countdown" : step.type,
          label: step.label ?? "",
          subtitle: step.text ?? null,
          seconds: step.durationSec,
          repeatCount: step.repeatCount,
          videoId: step.videoId ?? null,
          screenId: step.screenId ?? null,
          groupKey: item.id,
          groupLabel: item.id,
          groupRepeat: item.repeat,
        });
      }
    } else {
      out.push({
        kind: item.type === "guide" ? "countdown" : item.type,
        label: item.label ?? "",
        subtitle: item.text ?? null,
        seconds: item.durationSec,
        repeatCount: item.repeatCount,
        videoId: item.videoId ?? null,
        screenId: item.screenId ?? null,
        groupKey: null,
        groupLabel: null,
        groupRepeat: null,
      });
    }
  }
  return out;
}

function draftSnapshotKey(
  name: string,
  skinSlug: string,
  skinOpts: SharedProgram["skin"]["options"],
  stepList: Step[],
) {
  return builderDraftSnapshotKey(name, skinSlug, skinOpts, normalizeBuilderDirtySteps(stepList));
}

function blocksOf(steps: Step[]): Block[] {
  const blocks: Block[] = [];
  let index = 0;
  while (index < steps.length) {
    const step = steps[index];
    if (!step.groupKey) {
      blocks.push({ type: "single", index, step });
      index += 1;
      continue;
    }
    const key = step.groupKey;
    const indices: number[] = [];
    while (index < steps.length && steps[index].groupKey === key) {
      indices.push(index);
      index += 1;
    }
    const members = indices.map((i) => steps[i]);
    blocks.push({
      type: "group",
      key,
      label: members[0].groupLabel ?? "그룹",
      repeat: members[0].groupRepeat ?? 1,
      indices,
      seconds: members.reduce((sum, item) => sum + item.seconds, 0),
    });
  }
  return blocks;
}

function ticksFor(total: number) {
  if (total <= 0) return ["0:00"];
  const step = total <= 300 ? 60 : total <= 900 ? 120 : 300;
  const marks: number[] = [];
  for (let value = 0; value < total; value += step) marks.push(value);
  if (marks[marks.length - 1] !== total) marks.push(total);
  return marks.map(clock);
}

function newGroupKey() {
  return `g${Date.now().toString(36)}`;
}

function thumbFor(step: Step) {
  if (step.kind !== "exercise") return null;
  return THUMB[step.label] ?? "/media/thumb-shoulder-press-wide.jpg";
}

function toSharedType(kind: Kind): SharedStep["type"] {
  if (kind === "countdown") return "guide";
  return kind;
}

function stepKindFromScreen(screen: SkinScreenListItem | undefined): Kind {
  if (!screen) return "exercise";
  // hasVideoSlot wins when a screen declares both (e.g. ipt warmup)
  if (screen.hasVideoSlot) return "exercise";
  if (screen.hasNextVideoSlot) return "rest";
  return "countdown";
}

function findMissingVideoStepIndexes(
  steps: Step[],
  opts: { isHtmlSkin: boolean; screens: SkinScreenListItem[] },
): number[] {
  const screensById = new Map(opts.screens.map((screen) => [screen.id, screen]));
  const indexes: number[] = [];
  steps.forEach((step, index) => {
    const needsVideo = opts.isHtmlSkin
      ? !!(step.screenId && screensById.get(step.screenId)?.hasVideoSlot)
      : step.kind === "exercise";
    if (needsVideo && !step.videoId?.trim()) indexes.push(index);
  });
  return indexes;
}

function missingVideoStepsMessage(steps: Step[], indexes: number[]): string {
  const detail = indexes
    .map((index) => `${index + 1}단계 "${steps[index]?.label?.trim() || `${index + 1}단계`}"`)
    .join(", ");
  return `영상이 필요한 단계에 영상이 없어요: ${detail}`;
}

function stepScreenMissing(step: Step, screens: SkinScreenListItem[]): boolean {
  const screenId = step.screenId?.trim();
  if (!screenId) return false;
  return !screens.some((screen) => screen.id === screenId);
}

function stepVideoMissing(step: Step, screens: SkinScreenListItem[]): boolean {
  if (stepScreenMissing(step, screens)) return false;
  const screenId = step.screenId?.trim();
  if (!screenId) return false;
  const screen = screens.find((item) => item.id === screenId);
  return !!screen?.hasVideoSlot && !step.videoId?.trim();
}

function findMissingScreenStepIndexes(steps: Step[], screens: SkinScreenListItem[]): number[] {
  const indexes: number[] = [];
  steps.forEach((step, index) => {
    if (stepScreenMissing(step, screens)) indexes.push(index);
  });
  return indexes;
}

function missingScreenStepsMessage(indexes: number[]): string {
  const numbers = indexes.map((index) => index + 1).join(", ");
  return `삭제된 화면을 쓰는 단계가 있어요: ${numbers}단계. 다른 화면을 골라 주세요.`;
}

function stepUsesVideoRepeat(
  step: Step,
  opts: { isHtmlSkin: boolean; screen?: SkinScreenListItem; video?: VideoItem },
): boolean {
  const isVideoStep = opts.isHtmlSkin ? !!opts.screen?.hasVideoSlot : step.kind === "exercise";
  return isVideoStep && !!opts.video && opts.video.durationSec > 0;
}

export function builderStepToShared(
  step: Step,
  index: number,
  opts: { isHtmlSkin: boolean; screens: SkinScreenListItem[]; videos: VideoItem[] },
): SharedStep {
  const screen = step.screenId ? opts.screens.find((s) => s.id === step.screenId) : undefined;
  const video = step.videoId ? opts.videos.find((v) => v.id === step.videoId) : undefined;
  const sharedType = toSharedType(step.kind);
  const hasVideoSlot = opts.isHtmlSkin ? !!screen?.hasVideoSlot : step.kind === "exercise";
  let durationSec = clampStepDurationSec(step.seconds);
  let repeatCount: number | undefined;
  if (hasVideoSlot && video && video.durationSec > 0) {
    repeatCount = inferVideoStepRepeatCount({
      repeatCount: step.repeatCount,
      durationSec: step.seconds,
      videoDurationSec: video.durationSec,
    });
    durationSec = computeVideoStepDurationSec(repeatCount, video.durationSec);
  } else if (sharedType === "exercise" && step.repeatCount != null) {
    repeatCount = clampRepeatCount(step.repeatCount);
  }
  const out: SharedStep = {
    id: `step-${index}`,
    type: sharedType,
    durationSec,
    label: step.label,
    text: step.subtitle ?? undefined,
    videoId:
      opts.isHtmlSkin && screen && !screen.hasVideoSlot ? undefined : (step.videoId ?? undefined),
    screenId: step.screenId ?? undefined,
  };
  if (sharedType === "exercise" && repeatCount != null) out.repeatCount = repeatCount;
  return out;
}

function toSharedProgram(input: {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  publishedVersion: number | null;
  steps: Step[];
  skinSlug?: string;
  skinKind?: string;
  isHtmlSkin?: boolean;
  screens?: SkinScreenListItem[];
  videos?: VideoItem[];
}): SharedProgram {
  const publishOpts = {
    isHtmlSkin: !!input.isHtmlSkin,
    screens: input.screens ?? [],
    videos: input.videos ?? [],
  };
  const items: ProgramItem[] = [];
  let index = 0;
  while (index < input.steps.length) {
    const step = input.steps[index];
    if (!step.groupKey) {
      items.push(builderStepToShared(step, index, publishOpts));
      index += 1;
      continue;
    }
    const key = step.groupKey;
    const groupSteps: SharedStep[] = [];
    const start = index;
    while (index < input.steps.length && input.steps[index].groupKey === key) {
      const member = input.steps[index];
      groupSteps.push(builderStepToShared(member, index, publishOpts));
      index += 1;
    }
    items.push({
      id: `group-${key}-${start}`,
      type: "group",
      repeat: Math.max(2, step.groupRepeat ?? 2),
      steps: groupSteps,
    });
  }
  const skin: SharedProgram["skin"] = {
    id: input.skinSlug || "neon-arcade",
    options: { pointColor: "#C8F31D", nextLeadSec: 10 },
  };
  if (input.skinKind === "html" || input.skinKind === "tokens") skin.kind = input.skinKind as "html" | "tokens";
  return {
    id: input.id || "draft",
    name: input.name || "프로그램",
    status: input.status === "published" ? "published" : "draft",
    draftUpdatedAt: input.updatedAt || new Date().toISOString(),
    publishedVersion: input.publishedVersion,
    skin,
    items,
  };
}

export function BuilderScreen({
  initialId,
  onDeleted,
  onDirtyChange,
}: {
  initialId?: string;
  onDeleted?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [programId, setProgramId] = useState(initialId ?? "");
  const [name, setName] = useState("");
  const [skinOptions, setSkinOptions] = useState<SharedProgram["skin"]["options"]>({
    pointColor: "#C8F31D",
    nextLeadSec: 10,
    restImageUrl: "/skins/neon-arcade/rest_image.jpg",
  });
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [audioItems, setAudioItems] = useState<AudioItem[]>([]);
  const [voicePacks, setVoicePacks] = useState<VoicePackItem[]>([]);
  const [skins, setSkins] = useState<SkinItem[]>([]);
  const [skinScreens, setSkinScreens] = useState<SkinScreenListItem[]>([]);
  const [selectedSkinSlug, setSelectedSkinSlug] = useState("neon-arcade");
  const [steps, setSteps] = useState<Step[]>([]);
  const [selected, setSelected] = useState(0);
  const [published, setPublished] = useState<number | null>(null);
  const [status, setStatus] = useState("draft");
  const [needsRepublish, setNeedsRepublish] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [programRev, setProgramRev] = useState<number | undefined>(undefined);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [frame, setFrame] = useState<Frame>("next");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skinFrameOk, setSkinFrameOk] = useState<boolean | null>(null);
  const [videoForm, setVideoForm] = useState({ name: "", url: "", durationSec: 10, thumbnailUrl: "" });
  const [videoUrlDurationBusy, setVideoUrlDurationBusy] = useState(false);
  const videoUrlDurationGen = useRef(0);
  const dragFrom = useRef<number | null>(null);
  const snapshot = useRef("");
  const previewRef = useRef<HTMLIFrameElement | null>(null);
  const htmlPreviewWrapRef = useRef<HTMLDivElement | null>(null);
  const htmlPreviewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [stepRemainMs, setStepRemainMs] = useState<number | null>(null);
  const previewPlayingRef = useRef(false);
  const stepRemainRef = useRef<number | null>(null);
  const selectedRef = useRef(0);
  const stepsRef = useRef<Step[]>([]);
  const nameDefaultUntouched = useRef(false);

  function remember(program: Program) {
    setProgramId(program.id);
    setName(program.name);
    nameDefaultUntouched.current = program.name === "새 프로그램";
    setSkinOptions(program.skin.options);
    setSelectedSkinSlug(program.skin.id || "neon-arcade");
    setPublished(program.publishedVersion);
    setStatus(program.status);
    setNeedsRepublish(program.needsRepublish ?? false);
    setUpdatedAt(program.draftUpdatedAt);
    setSavedAt(new Date(program.draftUpdatedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }));
    setProgramRev(program.rev);
    const next = fromShared(program);
    snapshot.current = draftSnapshotKey(program.name, program.skin.id, program.skin.options, next);
    setSteps(next);
    setSelected((current) => Math.min(current, Math.max(0, next.length - 1)));
    setEmpty(false);
    setLoading(false);
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const cloud = isCloudDataMode();
      const [videoList, skinList, audioList, packList] = await Promise.all([
        api<{ items: VideoItem[] }>("/admin/v1/videos"),
        api<{ items: SkinItem[] }>("/admin/v1/skins"),
        cloud ? Promise.resolve({ items: [] as AudioItem[] }) : api<{ items: AudioItem[] }>("/admin/v1/audio"),
        cloud ? Promise.resolve({ items: [] as VoicePackItem[] }) : api<{ items: VoicePackItem[] }>("/admin/v1/voice-packs"),
      ]);
      setVideos(videoList.items);
      setSkins(skinList.items);
      setAudioItems(audioList.items);
      setVoicePacks(packList.items);
      // Never silently open another program when there is no initialId.
      if (!initialId) {
        setEmpty(true);
        setLoading(false);
        return;
      }
      remember(await api<Program>(`/admin/v1/programs/${initialId}`));
    })().catch((caught) => {
      setLoading(false);
      setError(caught instanceof ApiError ? caught.message : "프로그램을 불러오지 못했어요");
    });
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  const selectedSkin = useMemo(() => skins.find((s) => s.slug === selectedSkinSlug), [skins, selectedSkinSlug]);
  const isHtmlSkin = selectedSkin?.kind === "html";

  useEffect(() => {
    if (!selectedSkin || selectedSkin.kind !== "html") {
      setSkinScreens([]);
      return;
    }
    let cancelled = false;
    void api<{ items: SkinScreenListItem[] }>(`/admin/v1/skins/${selectedSkin.id}/screens`)
      .then((data) => {
        if (!cancelled) setSkinScreens(data.items);
      })
      .catch(() => {
        if (!cancelled) setSkinScreens([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSkin]);

  // HTML 스킨: screenId가 비었을 때만 기본 화면으로 채움 (삭제된 화면 id는 유지)
  useEffect(() => {
    if (!isHtmlSkin || !skinScreens.length) return;
    const fallback =
      skinScreens.find((screen) => screen.hasVideoSlot) ??
      skinScreens.find((screen) => screen.hasNextVideoSlot) ??
      skinScreens[0];
    if (!fallback) return;
    setSteps((current) => {
      let changed = false;
      const next = current.map((step) => {
        if (step.screenId != null && step.screenId.trim() !== "") return step;
        changed = true;
        const preferred =
          step.kind === "rest"
            ? (skinScreens.find((screen) => screen.hasNextVideoSlot && !screen.hasVideoSlot) ??
              skinScreens.find((screen) => screen.hasNextVideoSlot) ??
              fallback)
            : step.kind === "countdown"
              ? (skinScreens.find((screen) => screen.titleOnly) ?? fallback)
              : (skinScreens.find((screen) => screen.hasVideoSlot) ?? fallback);
        const video = step.videoId ? videos.find((item) => item.id === step.videoId) : undefined;
        const timing = timingForScreenChange(step, preferred, "auto_assign_screen", video);
        return {
          ...step,
          screenId: preferred.id,
          kind: stepKindFromScreen(preferred),
          label: step.label || preferred.title,
          seconds: timing.durationSec,
          repeatCount: timing.repeatCount,
        };
      });
      return changed ? next : current;
    });
  }, [isHtmlSkin, skinScreens, videos]);

  // HTML 스킨: 영상 슬롯 없는 화면에 남은 videoId 제거 (로드·화면 메타 동기화)
  useEffect(() => {
    if (!isHtmlSkin || !skinScreens.length) return;
    setSteps((current) => {
      const next = stripStaleBuilderStepVideoIds(current, skinScreens);
      const changed = next.some((step, index) => step.videoId !== current[index]?.videoId);
      if (!changed) return current;
      const wasDirty = draftSnapshotKey(name, selectedSkinSlug, skinOptions, current) !== snapshot.current;
      if (!wasDirty) {
        snapshot.current = draftSnapshotKey(name, selectedSkinSlug, skinOptions, next);
      }
      return next;
    });
  }, [isHtmlSkin, skinScreens, name, selectedSkinSlug, skinOptions]);

  const draftKey = useMemo(
    () => draftSnapshotKey(name, selectedSkinSlug, skinOptions, steps),
    [steps, name, skinOptions, selectedSkinSlug],
  );
  const isDirty = !!programId && !loading && draftKey !== snapshot.current;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  function confirmLeave(): boolean {
    if (!isDirty) return true;
    return window.confirm("저장하지 않은 변경이 있습니다. 나가시겠습니까?");
  }

  function syncSavedDraftBaseline(saved: Program) {
    const syncedSteps = fromShared(saved);
    setName(saved.name);
    setSkinOptions(saved.skin.options);
    setSelectedSkinSlug(saved.skin.id || selectedSkinSlug);
    setSteps(syncedSteps);
    snapshot.current = draftSnapshotKey(saved.name, saved.skin.id, saved.skin.options, syncedSteps);
  }

  async function persist(
    nextSteps: Step[],
    nextName = name,
    nextSkin = skinOptions,
    nextSkinSlug = selectedSkinSlug,
  ): Promise<Program | undefined> {
    if (!programId) return undefined;
    const skinRow = skins.find((s) => s.slug === nextSkinSlug);
    const draftProgram = toSharedProgram({
      id: programId,
      name: nextName,
      status: "draft",
      updatedAt: new Date().toISOString(),
      publishedVersion: published,
      steps: nextSteps,
      skinSlug: nextSkinSlug,
      skinKind: skinRow?.kind === "html" || skinRow?.kind === "tokens" ? skinRow.kind : undefined,
      isHtmlSkin,
      screens: skinScreens,
      videos,
    });
    draftProgram.skin.options = nextSkin;
    try {
      const saved = await api<Program>(`/admin/v1/programs/${programId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: nextName,
          draft: { items: draftProgram.items, skin: draftProgram.skin },
          ...(programRev != null ? { rev: programRev } : {}),
        }),
      });
      setProgramRev(saved.rev);
      setPublished(saved.publishedVersion);
      setStatus(saved.status);
      setNeedsRepublish(saved.needsRepublish ?? false);
      setUpdatedAt(saved.draftUpdatedAt);
      setSavedAt(new Date(saved.draftUpdatedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }));
      syncSavedDraftBaseline(saved);
      setError("");
      return saved;
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError("다른 곳에서 변경됨, 새로고침 필요");
      } else {
        setError(caught instanceof ApiError ? caught.message : "저장하지 못했어요");
      }
      throw caught;
    }
  }

  async function saveDraft(): Promise<boolean> {
    if (!programId || saving || !isDirty) return !isDirty;
    setSaving(true);
    setNotice("");
    try {
      await persist(steps, name, skinOptions, selectedSkinSlug);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const step = steps[selected];
    if (!step) return;
    setFrame(step.kind === "rest" ? "rest" : step.kind === "countdown" ? "next" : "exercise");
  }, [selected, steps]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    previewPlayingRef.current = previewPlaying;
  }, [previewPlaying]);

  function stopPreviewPlayback() {
    previewPlayingRef.current = false;
    setPreviewPlaying(false);
    stepRemainRef.current = null;
    setStepRemainMs(null);
    previewRef.current?.contentWindow?.postMessage({ type: "mvn:pause" }, "*");
  }

  function selectPreviewStep(index: number) {
    const clamped = Math.max(0, Math.min(index, Math.max(0, stepsRef.current.length - 1)));
    setSelected(clamped);
    if (previewPlayingRef.current || stepRemainRef.current != null) {
      const dur = Math.max(0, (stepsRef.current[clamped]?.seconds ?? 0) * 1000);
      stepRemainRef.current = dur;
      setStepRemainMs(dur);
    }
  }

  function togglePreviewPlayback() {
    if (previewPlayingRef.current) {
      previewPlayingRef.current = false;
      setPreviewPlaying(false);
      return;
    }
    const list = stepsRef.current;
    if (!list.length) return;
    if (stepRemainRef.current == null || stepRemainRef.current <= 0) {
      const dur = Math.max(0, (list[selectedRef.current]?.seconds ?? 0) * 1000);
      stepRemainRef.current = dur;
      setStepRemainMs(dur);
    }
    previewPlayingRef.current = true;
    setPreviewPlaying(true);
  }

  // Builder preview playhead: advance through steps by each step's duration.
  useEffect(() => {
    if (!previewPlaying) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const list = stepsRef.current;
      const cur = selectedRef.current;
      if (!list.length || cur < 0 || cur >= list.length) {
        stopPreviewPlayback();
        return;
      }
      let left = (stepRemainRef.current ?? list[cur].seconds * 1000) - dt;
      if (left > 0) {
        stepRemainRef.current = left;
        setStepRemainMs(left);
        return;
      }
      if (cur >= list.length - 1) {
        stepRemainRef.current = 0;
        setStepRemainMs(0);
        previewPlayingRef.current = false;
        setPreviewPlaying(false);
        return;
      }
      const next = cur + 1;
      const nextDur = Math.max(0, (list[next]?.seconds ?? 0) * 1000);
      selectedRef.current = next;
      setSelected(next);
      stepRemainRef.current = nextDur;
      setStepRemainMs(nextDur);
    }, 100);
    return () => window.clearInterval(timer);
  }, [previewPlaying]);

  // Stop playback when program/skin changes or builder unmounts.
  useEffect(() => {
    stopPreviewPlayback();
  }, [selectedSkinSlug, programId]);

  useEffect(() => () => stopPreviewPlayback(), []);

  // Tokens skin iframe: pause/resume to roughly follow builder play state.
  useEffect(() => {
    if (isHtmlSkin || stepRemainMs == null) return;
    previewRef.current?.contentWindow?.postMessage(
      { type: previewPlaying ? "mvn:resume" : "mvn:pause" },
      "*",
    );
  }, [previewPlaying, stepRemainMs, isHtmlSkin]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/skins/neon-arcade/index.html", { method: "HEAD" })
      .then((response) => {
        if (!cancelled) setSkinFrameOk(response.ok);
      })
      .catch(() => {
        if (!cancelled) setSkinFrameOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(index: number, patch: Partial<Step>) {
    const normalized = { ...patch };
    if (normalized.repeatCount != null) {
      normalized.repeatCount = clampRepeatCount(normalized.repeatCount);
      if (normalized.durationUserEdited !== false) normalized.durationUserEdited = true;
    }
    if (normalized.seconds != null) {
      normalized.seconds = clampStepDurationSec(normalized.seconds);
      if (normalized.durationUserEdited !== false) normalized.durationUserEdited = true;
    }
    setSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? { ...step, ...normalized } : step)));
  }

  function timingForScreenChange(
    step: Step,
    screen: SkinScreenListItem | undefined,
    reason: "user_picked_screen" | "auto_assign_screen",
    video?: VideoItem,
  ) {
    const hasVideoSlot = isHtmlSkin ? !!screen?.hasVideoSlot : step.kind === "exercise";
    return resolveVideoStepTimingOnScreenChange({
      reason,
      currentDurationSec: step.seconds,
      currentRepeatCount: step.repeatCount,
      durationUserEdited: step.durationUserEdited,
      screenDefaultDurationSec: screen?.defaultDurationSec,
      hasVideoSlot,
      videoDurationSec: video?.durationSec,
    });
  }

  function defaultVideoStepTiming(screen: SkinScreenListItem | undefined, video?: VideoItem) {
    if (video?.durationSec && video.durationSec > 0) {
      const repeatCount = resolveDefaultVideoStepRepeatCount({
        screenDefaultDurationSec: screen?.defaultDurationSec,
        videoDurationSec: video.durationSec,
      });
      return { repeatCount, durationSec: computeVideoStepDurationSec(repeatCount, video.durationSec) };
    }
    return {
      repeatCount: 1,
      durationSec: resolveVideoStepDurationSec({
        screenDefaultDurationSec: screen?.defaultDurationSec,
        videoDurationSec: video?.durationSec,
        fallbackSec: 45,
      }),
    };
  }

  function patchRepeatCount(repeatCount: number, video?: VideoItem): Partial<Step> {
    const rc = clampRepeatCount(repeatCount);
    const patch: Partial<Step> = { repeatCount: rc, durationUserEdited: true };
    if (video?.durationSec && video.durationSec > 0) {
      patch.seconds = computeVideoStepDurationSec(rc, video.durationSec);
    }
    return patch;
  }

  function updateGroup(key: string, patch: { groupLabel?: string; groupRepeat?: number }) {
    setSteps((current) =>
      current.map((step) =>
        step.groupKey === key
          ? {
              ...step,
              groupLabel: patch.groupLabel !== undefined ? patch.groupLabel : step.groupLabel,
              groupRepeat: patch.groupRepeat !== undefined ? patch.groupRepeat : step.groupRepeat,
            }
          : step,
      ),
    );
  }

  function move(from: number, to: number) {
    if (from === to) return;
    setSteps((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setSelected(to);
  }

  /** Swap with adjacent step only when both share the same groupKey (incl. both ungrouped). */
  function moveBy(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= steps.length) return;
    if ((steps[index].groupKey ?? null) !== (steps[to].groupKey ?? null)) return;
    move(index, to);
  }

  function defaultScreenForStep(): SkinScreenListItem | undefined {
    return skinScreens.find((s) => s.hasVideoSlot) ?? skinScreens[0];
  }

  function addStep() {
    setSteps((current) => {
      const screen = isHtmlSkin ? defaultScreenForStep() : undefined;
      const firstVideo = videos[0];
      const timing =
        screen?.hasVideoSlot || !isHtmlSkin
          ? defaultVideoStepTiming(screen, firstVideo)
          : {
              repeatCount: 1,
              durationSec: resolveVideoStepDurationSec({ screenDefaultDurationSec: screen?.defaultDurationSec, fallbackSec: 45 }),
            };
      const next = [
        ...current,
        {
          kind: isHtmlSkin ? stepKindFromScreen(screen) : ("exercise" as const),
          label: screen?.title ?? "새 운동",
          subtitle: isHtmlSkin ? null : "운동",
          seconds: timing.durationSec,
          repeatCount: timing.repeatCount,
          videoId: isHtmlSkin ? (screen?.hasVideoSlot ? firstVideo?.id ?? null : null) : firstVideo?.id ?? null,
          screenId: screen?.id ?? null,
          groupKey: null,
          groupLabel: null,
          groupRepeat: null,
        },
      ];
      setSelected(next.length - 1);
      return next;
    });
  }

  function addGroup() {
    const key = newGroupKey();
    setSteps((current) => {
      const next = [
        ...current,
        {
          kind: isHtmlSkin ? stepKindFromScreen(skinScreens.find((s) => s.hasVideoSlot)) : ("exercise" as const),
          label: isHtmlSkin ? (skinScreens.find((s) => s.hasVideoSlot)?.title ?? "새 운동") : "새 운동",
          subtitle: isHtmlSkin ? null : "운동",
          seconds: 45,
          videoId: isHtmlSkin ? (skinScreens.find((s) => s.hasVideoSlot) ? videos[0]?.id ?? null : null) : videos[0]?.id ?? null,
          screenId: isHtmlSkin ? (skinScreens.find((s) => s.hasVideoSlot)?.id ?? skinScreens[0]?.id ?? null) : null,
          groupKey: key,
          groupLabel: "새 그룹",
          groupRepeat: 3,
        },
        {
          kind: isHtmlSkin
            ? stepKindFromScreen(
                skinScreens.find((s) => s.hasNextVideoSlot && !s.hasVideoSlot) ??
                  skinScreens.find((s) => s.hasNextVideoSlot) ??
                  skinScreens.find((s) => s.titleOnly),
              )
            : ("rest" as const),
          label: isHtmlSkin
            ? (skinScreens.find((s) => s.hasNextVideoSlot && !s.hasVideoSlot)?.title ??
              skinScreens.find((s) => s.hasNextVideoSlot)?.title ??
              skinScreens.find((s) => s.titleOnly)?.title ??
              "휴식")
            : "휴식",
          subtitle: null,
          seconds: 15,
          videoId: null,
          screenId: isHtmlSkin
            ? (skinScreens.find((s) => s.hasNextVideoSlot && !s.hasVideoSlot)?.id ??
              skinScreens.find((s) => s.hasNextVideoSlot)?.id ??
              skinScreens.find((s) => s.titleOnly)?.id ??
              null)
            : null,
          groupKey: key,
          groupLabel: "새 그룹",
          groupRepeat: 3,
        },
      ];
      setSelected(next.length - 2);
      return next;
    });
  }

  function duplicateStep(index: number) {
    setSteps((current) => {
      const next = [...current];
      next.splice(index + 1, 0, { ...current[index] });
      setSelected(index + 1);
      return next;
    });
  }

  function removeStep(index: number) {
    setSteps((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((_, stepIndex) => stepIndex !== index);
      setSelected(Math.min(index, next.length - 1));
      return next;
    });
  }

  async function publish() {
    if (!programId || publishing) return;
    setError("");
    setNotice("");

    const publishErrors: string[] = [];
    let firstBadIndex: number | undefined;
    if (isHtmlSkin) {
      const missingScreenIndexes = findMissingScreenStepIndexes(steps, skinScreens);
      if (missingScreenIndexes.length) {
        publishErrors.push(missingScreenStepsMessage(missingScreenIndexes));
        firstBadIndex = missingScreenIndexes[0];
      }
    }
    const missingVideoIndexes = findMissingVideoStepIndexes(steps, { isHtmlSkin, screens: skinScreens });
    if (missingVideoIndexes.length) {
      publishErrors.push(missingVideoStepsMessage(steps, missingVideoIndexes));
      if (firstBadIndex === undefined) firstBadIndex = missingVideoIndexes[0];
    }
    if (publishErrors.length) {
      if (firstBadIndex !== undefined) setSelected(firstBadIndex);
      setError(publishErrors.join(" "));
      return;
    }

    setPublishing(true);
    try {
      if (isDirty) {
        try {
          await persist(steps, name, skinOptions, selectedSkinSlug);
        } catch {
          return;
        }
      }
      const result = await api<Program>(`/admin/v1/programs/${programId}/publish`, { method: "POST" });
      setPublished(result.publishedVersion);
      setStatus(result.status);
      setNeedsRepublish(result.needsRepublish ?? false);
      setUpdatedAt(result.draftUpdatedAt);
      setSavedAt(new Date(result.draftUpdatedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }));
      syncSavedDraftBaseline(result);
      setNotice(`v${result.publishedVersion}을 발행했어요`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "발행하지 못했어요");
    } finally {
      setPublishing(false);
    }
  }

  async function deleteProgram() {
    if (!programId) return;
    const label = name.trim() || "이 프로그램";
    if (!window.confirm(`"${label}" 프로그램을 삭제할까요?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/admin/v1/programs/${programId}`, { method: "DELETE" });
      onDeleted?.();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "프로그램을 삭제하지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function createProgram() {
    setBusy(true);
    setError("");
    try {
      const created = await api<Program>("/admin/v1/programs", {
        method: "POST",
        body: JSON.stringify({
          name: "새 프로그램",
          draft: {
            items: [
              { id: "guide-1", type: "guide", durationSec: 10, label: "시작 카운트다운", text: "카운트다운" },
              { id: "ex-1", type: "exercise", durationSec: 45, label: "새 운동", videoId: videos[0]?.id },
            ],
            skin: { id: selectedSkinSlug || "neon-arcade", options: skinOptions },
          },
        }),
      });
      window.history.replaceState(null, "", `/programs?id=${created.id}`);
      remember(created);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "프로그램을 만들지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function probeBuilderYouTubeDuration(url: string) {
    if (!isYouTubeUrl(url)) return;
    const gen = ++videoUrlDurationGen.current;
    setVideoUrlDurationBusy(true);
    try {
      const sec = await fetchYouTubeDurationSec(url);
      if (gen !== videoUrlDurationGen.current) return;
      if (sec && sec > 0) {
        setVideoForm((prev) => (prev.url.trim() === url.trim() ? { ...prev, durationSec: sec } : prev));
      }
    } catch {
      /* manual */
    } finally {
      if (gen === videoUrlDurationGen.current) setVideoUrlDurationBusy(false);
    }
  }

  async function registerVideo() {
    try {
      const url = videoForm.url.trim();
      if (!url) throw new Error("URL이 필요해요");
      if (isYouTubeUrl(url) && (!videoForm.durationSec || videoForm.durationSec < 1)) {
        throw new Error("YouTube 영상 길이(초)를 확인하거나 입력해 주세요");
      }
      const thumbnailUrl = resolveExternalVideoThumbnail(url, videoForm.thumbnailUrl || url);
      const created = await api<VideoItem>("/admin/v1/videos", {
        method: "POST",
        body: JSON.stringify({
          name: videoForm.name || "새 영상",
          url,
          durationSec: Number(videoForm.durationSec) || 10,
          thumbnailUrl,
          width: 1920,
          height: 1080,
        }),
      });
      setVideos((current) => [created, ...current]);
      setVideoForm({ name: "", url: "", durationSec: 10, thumbnailUrl: "" });
      setNotice(`영상 ${created.name}을 등록했어요`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "영상을 등록하지 못했어요");
    }
  }

  async function openVersions() {
    if (!programId) return;
    setVersionsOpen((open) => !open);
    if (versionsOpen) return;
    try {
      const data = await api<{ items: VersionItem[] }>(`/admin/v1/programs/${programId}/versions`);
      setVersions(data.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "버전을 불러오지 못했어요");
    }
  }

  const current = steps[selected];
  const currentScreen = useMemo(
    () => (current?.screenId ? skinScreens.find((s) => s.id === current.screenId) : undefined),
    [current?.screenId, skinScreens],
  );
  const currentScreenMissing = isHtmlSkin && !!current && stepScreenMissing(current, skinScreens);
  const currentVideoMissing = isHtmlSkin && !!current && stepVideoMissing(current, skinScreens);
  const showExerciseVideo = isHtmlSkin ? !!currentScreen?.hasVideoSlot : current?.kind === "exercise";
  const pickedVideo = current?.videoId ? videos.find((video) => video.id === current.videoId) : undefined;
  const useRepeatCountInput =
    !!current && stepUsesVideoRepeat(current, { isHtmlSkin, screen: currentScreen, video: pickedVideo });
  const displayRepeatCount =
    useRepeatCountInput && pickedVideo
      ? inferVideoStepRepeatCount({
          repeatCount: current.repeatCount,
          durationSec: current.seconds,
          videoDurationSec: pickedVideo.durationSec,
        })
      : null;
  const sharedProgram = useMemo(() => {
    const program = toSharedProgram({
      id: programId,
      name,
      status,
      updatedAt: updatedAt || new Date().toISOString(),
      publishedVersion: published,
      steps,
      skinSlug: selectedSkinSlug,
      skinKind: selectedSkin?.kind === "html" || selectedSkin?.kind === "tokens" ? selectedSkin.kind : undefined,
      isHtmlSkin,
      screens: skinScreens,
      videos,
    });
    program.skin.options = skinOptions;
    const currentSkin = skins.find((s) => s.slug === selectedSkinSlug);
    if (currentSkin?.tokens) {
      (program.skin as { tokens?: Record<string, unknown> }).tokens = currentSkin.tokens;
    }
    return program;
  }, [programId, name, status, updatedAt, published, steps, skinOptions, selectedSkinSlug, skins, selectedSkin, isHtmlSkin, skinScreens, videos]);
  const videoMap = useMemo(() => Object.fromEntries(videos.map((video) => [video.id, video])), [videos]);
  const playItems = useMemo(() => expand(sharedProgram, videoMap), [sharedProgram, videoMap]);
  const total = playTotalSec(playItems);
  const exercise = playItems.filter((item) => item.type === "exercise").reduce((sum, item) => sum + item.durationSec, 0);
  const rest = playItems.filter((item) => item.type === "rest").reduce((sum, item) => sum + item.durationSec, 0);
  const selectedPlayIndex = playItems.findIndex((item) => item.stepId === `step-${selected}`);
  const selectedStepDuration = playItems[selectedPlayIndex]?.durationSec ?? current?.seconds ?? 0;
  const stepProgressSec =
    stepRemainMs != null
      ? Math.max(0, selectedStepDuration - stepRemainMs / 1000)
      : selectedStepDuration / 2;
  const playElapsed =
    selectedPlayIndex < 0
      ? 0
      : playItems.slice(0, selectedPlayIndex).reduce((sum, item) => sum + item.durationSec, 0) + stepProgressSec;
  const blocks = useMemo(() => blocksOf(steps), [steps]);
  const groups = useMemo(() => {
    if (!total) return [] as Array<{ left: number; width: number; label: string }>;
    const result: Array<{ left: number; width: number; label: string }> = [];
    let cursor = 0;
    let index = 0;
    while (index < steps.length) {
      const step = steps[index];
      if (!step.groupKey) {
        cursor += step.seconds;
        index += 1;
        continue;
      }
      const key = step.groupKey;
      const start = cursor;
      let oneLoop = 0;
      const label = step.groupLabel ?? "그룹";
      const repeat = Math.max(2, step.groupRepeat ?? 2);
      while (index < steps.length && steps[index].groupKey === key) {
        oneLoop += steps[index].seconds;
        index += 1;
      }
      const span = oneLoop * repeat;
      cursor += span;
      result.push({
        left: (start / total) * 100,
        width: (span / total) * 100,
        label: `${label.replace(/\s*·.*$/, "")} ×${repeat}`,
      });
    }
    return result;
  }, [steps, total]);
  const ticks = useMemo(() => ticksFor(total), [total]);
  const playhead = total ? (playElapsed / total) * 100 : 0;
  const preview = FRAME_SRC[frame];
  const thumb = current ? thumbFor(current) : null;
  const showRepublishBadge = needsRepublish || (published != null && status === "draft");

  useEffect(() => {
    if (isHtmlSkin || !skinFrameOk || !previewRef.current?.contentWindow) return;
    previewRef.current.contentWindow.postMessage(
      {
        type: "mvn:program",
        program: { ...sharedProgram, playItems, videos: videoMap },
      },
      "*",
    );
  }, [sharedProgram, playItems, skinFrameOk, videoMap, isHtmlSkin]);

  const htmlPreview = useMemo(() => {
    if (!isHtmlSkin || !current) return null;
    let nextLabel = "";
    let nextVideoUrl: string | null = null;
    let afterRest = false;
    for (let i = selected + 1; i < steps.length; i += 1) {
      const s = steps[i];
      if (s.kind === "rest") {
        afterRest = true;
        continue;
      }
      if (s.kind === "exercise") {
        nextLabel = s.label;
        nextVideoUrl = s.videoId ? videoMap[s.videoId]?.url ?? null : null;
        break;
      }
    }
    const tokens: HtmlSkinTokenMap = {
      label: current.label,
      remainingSec: current.seconds,
      totalSec: current.seconds,
      "next.label": nextLabel,
      "next.afterRest": afterRest,
      round: 1,
      roundTotal: 1,
      stepIndex: selected + 1,
      stepTotal: steps.length,
      set: 1,
      setTotal: 1,
      "program.name": name,
      logoUrl: String(skinOptions.logoUrl ?? ""),
      pointColor: skinOptions.pointColor ?? "#C8F31D",
    };
    const videoUrl = current.videoId ? videoMap[current.videoId]?.url ?? null : null;
    const baseHref = typeof window !== "undefined" ? `${window.location.origin}/` : "/";
    const srcdoc = buildHtmlSkinStepPreviewDocument({
      screens: skinScreens,
      screenId: current.screenId ?? undefined,
      tokens,
      videoUrl,
      nextVideoUrl,
      baseHref,
    });
    const key = `${selected}:${current.screenId ?? ""}:${videoUrl ?? ""}:${nextVideoUrl ?? ""}`;
    const sandbox =
      (videoUrl && parseYouTubeVideoId(videoUrl)) || (nextVideoUrl && parseYouTubeVideoId(nextVideoUrl))
        ? "allow-scripts allow-same-origin"
        : "";
    return { srcdoc, key, sandbox };
  }, [isHtmlSkin, current, selected, steps, videoMap, name, skinOptions, skinScreens]);

  useEffect(() => {
    if (!isHtmlSkin || !htmlPreview) return;
    const wrap = htmlPreviewWrapRef.current;
    const iframe = htmlPreviewIframeRef.current;
    if (!wrap || !iframe) return;

    const relayout = () => {
      const width = wrap.clientWidth;
      if (!width) return;
      const scale = width / 1920;
      iframe.style.transform = `scale(${scale})`;
      wrap.style.height = `${1080 * scale}px`;
    };

    relayout();
    const observer = new ResizeObserver(relayout);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [isHtmlSkin, htmlPreview]);

  if (loading) {
    return <p className="subtle" style={{ padding: 24 }}>프로그램을 불러오는 중이에요</p>;
  }

  if (empty) {
    return (
      <div className="page-head" style={{ padding: 24 }}>
        <div>
          <h1 className="t-title">프로그램</h1>
          <p>아직 만든 프로그램이 없어요. 첫 초안을 만들면 TV 단계 편집기를 바로 쓸 수 있어요.</p>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createProgram()}>
          <Plus className="i" aria-hidden />
          새 프로그램
        </button>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    );
  }

  function renderStepRow(step: Step, index: number) {
    const screenMissing = isHtmlSkin && stepScreenMissing(step, skinScreens);
    const videoMissing = isHtmlSkin && stepVideoMissing(step, skinScreens);
    const sameGroup = (a: number, b: number) =>
      a >= 0 && b >= 0 && a < steps.length && b < steps.length && (steps[a].groupKey ?? null) === (steps[b].groupKey ?? null);
    const canUp = sameGroup(index, index - 1);
    const canDown = sameGroup(index, index + 1);
    return (
      <div
        key={`${step.label}-${index}`}
        className={["step", index === selected ? "sel" : "", step.kind === "rest" ? "rest" : ""].filter(Boolean).join(" ")}
        role="button"
        tabIndex={0}
        aria-label={step.label}
        draggable
        onDragStart={() => {
          dragFrom.current = index;
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (dragFrom.current != null) move(dragFrom.current, index);
          dragFrom.current = null;
        }}
        onClick={() => selectPreviewStep(index)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectPreviewStep(index);
          }
        }}
      >
        <GripVertical className="i grip" aria-hidden />
        <span className="n">{index + 1}</span>
        <span
          className={`ty ${step.kind === "countdown" ? "ty-c" : step.kind === "rest" ? "ty-r" : "ty-e"}`}
          style={thumbFor(step) && step.kind === "exercise" && THUMB[step.label] ? { background: "#fff", border: "1px solid var(--gray-100)" } : undefined}
        >
          {THUMB[step.label] && step.kind === "exercise" ? (
            <img src={THUMB[step.label]} alt="" />
          ) : step.kind === "rest" ? (
            <Coffee className="i i-sm" aria-hidden />
          ) : step.kind === "countdown" ? (
            <Timer className="i i-sm" aria-hidden />
          ) : (
            <Play className="i i-sm" aria-hidden />
          )}
        </span>
        <div className="nm">
          <b>{step.label}</b>
          {screenMissing ? (
            <small style={{ color: "var(--danger, #b91c1c)", display: "block" }}>화면 없음</small>
          ) : videoMissing ? (
            <small style={{ color: "var(--danger, #b91c1c)", display: "block" }}>영상 없음</small>
          ) : step.subtitle ? (
            <small>{step.subtitle}</small>
          ) : null}
        </div>
        <span className="dur">{clock(step.seconds)}</span>
        <div className="ord">
          <button
            type="button"
            className="ord-btn"
            aria-label="위로"
            title="위로"
            disabled={!canUp}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              moveBy(index, -1);
            }}
          >
            ▲
          </button>
          <button
            type="button"
            className="ord-btn"
            aria-label="아래로"
            title="아래로"
            disabled={!canDown}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              moveBy(index, 1);
            }}
          >
            ▼
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="editbar">
        <a
          className="icon-btn"
          href="/"
          aria-label="대시보드"
          onClick={(event) => {
            if (!confirmLeave()) event.preventDefault();
          }}
        >
          <ArrowLeft className="i" aria-hidden />
        </a>
        <div className="crumbs">
          <span>프로그램</span>
          <ChevronRight className="i" aria-hidden />
        </div>
        <input
          className="title"
          value={name}
          onFocus={(event) => {
            if (nameDefaultUntouched.current && name === "새 프로그램") {
              event.currentTarget.select();
            }
          }}
          onChange={(event) => {
            nameDefaultUntouched.current = false;
            setName(event.target.value);
          }}
          aria-label="프로그램 이름"
          style={{ border: 0, background: "transparent", width: 180 }}
        />
        <span className="badge badge-warn">
          <span className="dot" />
          {status === "published" ? "게시됨" : "초안"}
        </span>
        {showRepublishBadge ? <span className="badge badge-outline" style={{ color: "var(--danger, #b91c1c)" }}>재게시 필요</span> : null}
        <span className={`saved${isDirty ? " text-warn" : ""}`} data-testid="builder-save-status">
          <CheckCheck className="i i-sm" aria-hidden />
          {saving
            ? "저장 중…"
            : isDirty
              ? "저장 안 됨"
              : savedAt
                ? `저장됨 · ${savedAt}`
                : loading
                  ? "불러오는 중"
                  : "—"}
        </span>
        <div className="row" style={{ marginLeft: "auto" }}>
          <span className="t-sm subtle" style={{ marginRight: 4 }}>
            {published ? `발행본 v${published}` : "아직 발행 전이에요"}
          </span>
          <button type="button" className="icon-btn" aria-label="버전 기록" onClick={() => void openVersions()}>
            <History className="i" aria-hidden />
          </button>
          <span className="vsep" />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNotice("TV 미리보기 전송 API가 아직 없어요")}>
            <Cast className="i" aria-hidden />
            TV로 미리보기
          </button>
          <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => void deleteProgram()}>
            <Trash2 className="i" aria-hidden />
            삭제
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            data-testid="builder-save"
            disabled={saving || busy || !isDirty}
            onClick={() => void saveDraft()}
          >
            <Save className="i" aria-hidden />
            {saving ? "저장 중…" : "저장"}
          </button>
          <button
            type="button"
            className="btn btn-accent btn-sm"
            disabled={publishing || busy || saving}
            onClick={() => void publish()}
          >
            <Send className="i" aria-hidden />
            {publishing ? "발행 중…" : published != null ? "재발행" : "발행하기"}
          </button>
        </div>
      </header>
      {error ? (
        <p className="form-error" style={{ margin: "8px 16px 0" }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="pair-box" style={{ margin: "8px 16px 0" }}>
          {notice}
        </p>
      ) : null}
      {versionsOpen ? (
        <div className="pair-box" style={{ margin: "8px 16px 0", maxHeight: 160, overflow: "auto", display: "block" }}>
          <b style={{ display: "block", marginBottom: 8 }}>발행 버전</b>
          {versions.length === 0 ? (
            <span className="subtle">아직 발행한 버전이 없어요</span>
          ) : (
            versions.map((version) => (
              <div key={version.id} className="row" style={{ justifyContent: "space-between", padding: "4px 0" }}>
                <span>
                  v{version.version} · {version.name}
                </span>
                <span className="subtle">
                  {version.stepCount}단계 · {selectedSkinSlug} ·{" "}
                  {new Date(version.publishedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
      <div className="builder">
        <section className="steps">
          <div className="panel-head">
            <div>
              <h2>단계</h2>
              <small>
                {steps.length}단계 · 총 {clock(total)} · 운동 {clock(exercise)} / 휴식 {clock(rest)}
              </small>
            </div>
          </div>
          <div className="step-scroll">
            {blocks.map((block) => {
              if (block.type === "single") return renderStepRow(block.step, block.index);
              const closed = collapsed[block.key];
              return (
                <div key={block.key} className={closed ? "group collapsed" : "group"}>
                  <div
                    className="group-head"
                    role="button"
                    tabIndex={0}
                    onClick={() => setCollapsed((current) => ({ ...current, [block.key]: !current[block.key] }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setCollapsed((current) => ({ ...current, [block.key]: !current[block.key] }));
                      }
                    }}
                  >
                    {closed ? <ChevronRight className="i i-sm" aria-hidden /> : <ChevronDown className="i i-sm" aria-hidden />}
                    {block.label}
                    <span className="rep">
                      <Repeat2 className="i i-sm" style={{ width: 11, height: 11 }} aria-hidden />
                      {block.repeat}
                    </span>
                    {closed ? <span className="subtle" style={{ fontWeight: 500 }}>{block.indices.length}단계</span> : null}
                    <span className="t">{clock(block.seconds * Math.max(1, block.repeat))}</span>
                  </div>
                  {closed ? null : block.indices.map((index) => renderStepRow(steps[index], index))}
                </div>
              );
            })}
          </div>
          <div className="add-row">
            <button type="button" className="btn btn-sm btn-dashed" onClick={addStep}>
              <Plus className="i" aria-hidden />
              단계 추가
            </button>
            <button type="button" className="btn btn-sm btn-dashed" onClick={addGroup}>
              <Repeat2 className="i" aria-hidden />
              반복 그룹
            </button>
          </div>
        </section>

        <section className="stage">
          <div className="stage-bar">
            <span className="lbl">
              <Tv className="i i-sm" aria-hidden />
              TV 미리보기 · 1920×1080
            </span>
            <div className="seg-dark" style={{ marginLeft: "auto" }}>
              {(
                [
                  ["exercise", "운동"],
                  ["next", "NEXT 예고"],
                  ["rest", "휴식"],
                ] as const
              ).map(([id, label]) => (
                <span
                  key={id}
                  role="button"
                  tabIndex={0}
                  className={frame === id ? "on" : undefined}
                  onClick={() => setFrame(id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setFrame(id);
                    }
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
            <select
              className="sel-dark"
              value={selectedSkinSlug}
              onChange={(e) => setSelectedSkinSlug(e.target.value)}
              style={{ background: "var(--gray-800)", border: "1px solid var(--gray-600)", borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 13 }}
            >
              {skins
                .filter((s) => s.isActive || s.slug === selectedSkinSlug)
                .map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="tv-wrap" style={{ alignItems: "center" }}>
            <div className="tv">
              {isHtmlSkin && htmlPreview ? (
                <div
                  ref={htmlPreviewWrapRef}
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    overflow: "hidden",
                    borderRadius: 5,
                    background: "#000",
                  }}
                >
                  <iframe
                    key={htmlPreview.key}
                    ref={htmlPreviewIframeRef}
                    title="HTML 스킨 미리보기"
                    sandbox={htmlPreview.sandbox || undefined}
                    srcDoc={htmlPreview.srcdoc}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: 1920,
                      height: 1080,
                      border: 0,
                      background: "#000",
                      transformOrigin: "top left",
                      display: "block",
                    }}
                  />
                </div>
              ) : skinFrameOk ? (
                <iframe
                  ref={previewRef}
                  title="네온 아케이드 미리보기"
                  src="/skins/neon-arcade/index.html"
                  style={{ width: "100%", aspectRatio: "16 / 9", border: 0, borderRadius: 5, background: "#000", display: "block" }}
                  onLoad={() => {
                    previewRef.current?.contentWindow?.postMessage(
                      { type: "mvn:program", program: { ...sharedProgram, playItems, videos: videoMap } },
                      "*",
                    );
                  }}
                />
              ) : (
                <>
                  <img src={preview.src} alt={preview.alt} />
                  <span className="tv-tag">
                    <Eye className="i i-sm" aria-hidden />
                    {skinFrameOk === false ? "스킨 파일 없음 · 내장 미리보기" : preview.tag}
                  </span>
                </>
              )}
            </div>
            <div className="transport" style={{ width: "100%", maxWidth: 760, marginTop: 16, padding: 0 }}>
              <span className="ttime">
                <b>{clock(Math.floor(playElapsed))}</b> / {clock(total)}
              </span>
              <button
                type="button"
                className="tbtn"
                aria-label="이전 단계"
                onClick={() => selectPreviewStep(selected - 1)}
              >
                <SkipBack className="i" aria-hidden />
              </button>
              <button
                type="button"
                className="tbtn play"
                aria-label={previewPlaying ? "일시정지" : "재생 미리보기"}
                onClick={() => togglePreviewPlayback()}
              >
                {previewPlaying ? <Pause className="i" aria-hidden /> : <Play className="i" aria-hidden />}
              </button>
              <button
                type="button"
                className="tbtn"
                aria-label="다음 단계"
                onClick={() => selectPreviewStep(selected + 1)}
              >
                <SkipForward className="i" aria-hidden />
              </button>
              <span className="ttime" style={{ textAlign: "right" }}>
                단계 {steps.length ? selected + 1 : 0}
                {stepRemainMs != null ? ` · 남음 ${clock(Math.ceil(stepRemainMs / 1000))}` : ""}
                {current?.groupRepeat ? ` · 1/${current.groupRepeat}세트` : ""}
              </span>
            </div>
          </div>
          <div className="timeline">
            <div className="tl-head">
              <span>타임라인 · {clock(total)}</span>
              <div className="legend">
                <span>
                  <i style={{ background: "#5D6661" }} />
                  카운트다운
                </span>
                <span>
                  <i style={{ background: "#D7DCD8" }} />
                  운동
                </span>
                <span>
                  <i style={{ background: "var(--sofa-500)" }} />
                  휴식
                </span>
                <span>
                  <i style={{ background: "var(--volt-500)" }} />
                  선택
                </span>
              </div>
            </div>
            <div className="tl">
              <div className="tl-groups">
                {groups.map((group) => (
                  <span key={`${group.label}-${group.left}`} style={{ left: `${group.left}%`, width: `${group.width}%` }}>
                    {group.label}
                  </span>
                ))}
              </div>
              <div className="tl-track">
                {playItems.map((item) => {
                  const stepIndex = Number(item.stepId.replace("step-", ""));
                  const selectedSeg = stepIndex === selected;
                  return (
                    <i
                      key={`${item.stepId}-${item.index}`}
                      className={selectedSeg ? "seg-e sel" : item.type === "guide" ? "seg-c" : item.type === "rest" ? "seg-r" : "seg-e"}
                      style={{ flex: Math.max(item.durationSec, 1), cursor: "pointer" }}
                      onClick={() => {
                        if (Number.isFinite(stepIndex)) selectPreviewStep(stepIndex);
                      }}
                    />
                  );
                })}
              </div>
              {total ? <span className="playhead" style={{ left: `${playhead}%` }} /> : null}
            </div>
            <div className="ticks">
              {ticks.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
          </div>
        </section>

        <aside className="insp">
          <div className="panel-head">
            <div>
              <h2>단계 설정</h2>
              <small>
                {steps.length ? `${selected + 1} / ${steps.length}` : "0 / 0"}
                {current?.groupLabel ? ` · ${current.groupLabel}` : ""}
              </small>
            </div>
          </div>
          {!isCloudDataMode() ? (
            <div className="insp-body" style={{ borderBottom: "1px solid var(--border, #e5e7eb)", paddingBottom: 12, marginBottom: 4 }}>
              <div className="field">
                <span className="label">배경음악</span>
                <select
                  className="input"
                  value={skinOptions.musicId ?? ""}
                  onChange={(event) =>
                    setSkinOptions((prev) => ({
                      ...prev,
                      musicId: event.target.value || undefined,
                    }))
                  }
                >
                  <option value="">기본 음악</option>
                  {audioItems
                    .filter((item) => item.kind === "music")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <span className="label">음성 팩</span>
                <select
                  className="input"
                  value={skinOptions.voicePackId ?? ""}
                  onChange={(event) =>
                    setSkinOptions((prev) => ({
                      ...prev,
                      voicePackId: event.target.value || undefined,
                    }))
                  }
                >
                  <option value="">기본 음성 팩</option>
                  {voicePacks.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name}
                      {pack.isDefault ? " (기본)" : ""}
                    </option>
                  ))}
                </select>
                <small>게시에 url이 스냅샷에 풀립니다</small>
              </div>
            </div>
          ) : null}
          {current ? (
            <>
              <div className="insp-body">
                {isHtmlSkin ? (
                  <div className="field">
                    <span className="label">
                      화면
                      {currentScreenMissing ? (
                        <span className="badge badge-outline" style={{ marginLeft: 8, color: "var(--danger, #b91c1c)" }}>
                          화면 없음
                        </span>
                      ) : null}
                    </span>
                    <select
                      className="input"
                      value={current.screenId ?? ""}
                      onChange={(event) => {
                        const screen = skinScreens.find((s) => s.id === event.target.value);
                        const patch: Partial<Step> = {
                          screenId: event.target.value || null,
                          kind: stepKindFromScreen(screen),
                          label: screen?.title ?? current.label,
                        };
                        if (!screen?.hasVideoSlot) {
                          patch.videoId = null;
                        }
                        if (screen) {
                          const video = current.videoId ? videos.find((item) => item.id === current.videoId) : undefined;
                          const timing = timingForScreenChange(current, screen, "user_picked_screen", video);
                          patch.seconds = timing.durationSec;
                          patch.repeatCount = timing.repeatCount;
                          patch.durationUserEdited = false;
                        }
                        update(selected, patch);
                      }}
                    >
                      <option value="">화면 선택</option>
                      {currentScreenMissing && current.screenId ? (
                        <option value={current.screenId}>화면 없음 (삭제됨)</option>
                      ) : null}
                      {skinScreens.map((screen) => (
                        <option key={screen.id} value={screen.id}>
                          {screen.title}
                          {screen.hasVideoSlot ? " · 영상" : screen.hasNextVideoSlot ? " · 다음 영상" : screen.titleOnly ? " · 타이틀" : ""}
                        </option>
                      ))}
                    </select>
                    {currentScreen?.hasNextVideoSlot ? (
                      <small>다음 영상은 이후 운동 스텝 영상을 플레이어가 자동 사용해요</small>
                    ) : null}
                  </div>
                ) : (
                  <div className="field">
                    <span className="label">단계 유형</span>
                    <div className="seg seg-full">
                      {(
                        [
                          ["countdown", "카운트다운"],
                          ["exercise", "운동"],
                          ["rest", "휴식"],
                        ] as const
                      ).map(([kind, label]) => (
                        <button key={kind} type="button" className={current.kind === kind ? "on" : undefined} onClick={() => update(selected, { kind })}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {showExerciseVideo ? (
                  <div className="field">
                    <span className="label">
                      운동 영상
                      {currentVideoMissing ? (
                        <span className="badge badge-outline" style={{ marginLeft: 8, color: "var(--danger, #b91c1c)" }}>
                          영상 없음
                        </span>
                      ) : null}
                    </span>
                    <div className="media">
                      <span className="thumb">
                        {(() => {
                          const picked = videos.find((video) => video.id === current.videoId);
                          const src = picked?.thumbnailUrl || thumb;
                          return src ? <img src={src} alt="" /> : null;
                        })()}
                      </span>
                      <div className="grow">
                        <select
                          className="input"
                          value={current.videoId ?? ""}
                          onChange={(event) => {
                            const video = videos.find((item) => item.id === event.target.value);
                            const patch: Partial<Step> = {
                              videoId: event.target.value || null,
                              label: isHtmlSkin ? current.label : current.label || video?.name || "새 운동",
                            };
                            if (video) {
                              const timing = defaultVideoStepTiming(currentScreen, video);
                              patch.seconds = timing.durationSec;
                              patch.repeatCount = timing.repeatCount;
                              patch.durationUserEdited = false;
                            }
                            update(selected, patch);
                          }}
                        >
                          <option value="">영상 선택</option>
                          {videos.filter((v) => !v.status || v.status === "ready").map((video) => (
                            <option key={video.id} value={video.id}>
                              {video.name}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const picked = videos.find((video) => video.id === current.videoId);
                          return picked ? (
                            <>
                              {useRepeatCountInput && displayRepeatCount != null ? (
                                <div className="field" style={{ marginTop: 8 }}>
                                  <span className="label">반복 횟수</span>
                                  <div className="stepper">
                                    <button
                                      type="button"
                                      aria-label="반복 줄이기"
                                      onClick={() => update(selected, patchRepeatCount(displayRepeatCount - 1, picked))}
                                    >
                                      <Minus className="i" aria-hidden />
                                    </button>
                                    <input
                                      className="input"
                                      type="number"
                                      min={1}
                                      max={99}
                                      step={1}
                                      style={{ width: 56, textAlign: "center" }}
                                      value={displayRepeatCount}
                                      onChange={(event) => {
                                        const raw = Number(event.target.value);
                                        if (Number.isFinite(raw)) update(selected, patchRepeatCount(raw, picked));
                                      }}
                                    />
                                    <button
                                      type="button"
                                      aria-label="반복 늘리기"
                                      onClick={() => update(selected, patchRepeatCount(displayRepeatCount + 1, picked))}
                                    >
                                      <Plus className="i" aria-hidden />
                                    </button>
                                  </div>
                                  <small>
                                    영상 {picked.durationSec}초 × {displayRepeatCount}회 = {current.seconds}초
                                  </small>
                                </div>
                              ) : (
                                <small>영상 길이를 알 수 없어요 · 아래에서 단계 시간을 직접 입력해 주세요</small>
                              )}
                            </>
                          ) : (
                            <small>URL 등록 방식 · GIF→mp4 변환은 나중에</small>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="two" style={{ marginTop: 8 }}>
                      <input
                        className="input"
                        placeholder="영상 이름"
                        value={videoForm.name}
                        onChange={(event) => setVideoForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                      />
                      <input
                        className="input"
                        placeholder="https://…mp4 또는 YouTube"
                        value={videoForm.url}
                        onChange={(event) => setVideoForm((currentForm) => ({ ...currentForm, url: event.target.value }))}
                        onBlur={() => {
                          const url = videoForm.url.trim();
                          if (url && isYouTubeUrl(url)) void probeBuilderYouTubeDuration(url);
                        }}
                      />
                    </div>
                    {videoUrlDurationBusy ? (
                      <small style={{ display: "block", marginTop: 6 }}>YouTube 길이 확인 중…</small>
                    ) : isYouTubeUrl(videoForm.url) && videoForm.durationSec > 0 ? (
                      <small style={{ display: "block", marginTop: 6 }}>YouTube 길이 {videoForm.durationSec}초</small>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 8 }}
                      disabled={!videoForm.url || videoUrlDurationBusy}
                      onClick={() => void registerVideo()}
                    >
                      영상 URL 등록
                    </button>
                  </div>
                ) : null}
                <div className="field">
                  <span className="label">TV 표시 이름</span>
                  <input className="input" value={current.label} onChange={(event) => update(selected, { label: event.target.value })} />
                </div>
                <div className="field">
                  <span className="label">부제</span>
                  <input
                    className="input"
                    value={current.subtitle ?? ""}
                    onChange={(event) => update(selected, { subtitle: event.target.value || null })}
                    placeholder={current.kind === "rest" ? "선택" : "운동 · 12회"}
                  />
                </div>
                {!useRepeatCountInput ? (
                  <div className="field">
                    <span className="label">
                      {isHtmlSkin
                        ? currentScreen?.titleOnly
                          ? "재생 시간"
                          : "재생 시간"
                        : current.kind === "rest"
                          ? "휴식 시간"
                          : current.kind === "countdown"
                            ? "카운트다운"
                            : pickedVideo
                              ? "운동 시간"
                              : "운동 시간"}
                    </span>
                    <div className="stepper">
                      <button type="button" aria-label="5초 줄이기" onClick={() => update(selected, { seconds: Math.max(1, current.seconds - 5) })}>
                        <Minus className="i" aria-hidden />
                      </button>
                      <span className="v">{current.seconds}초</span>
                      <button type="button" aria-label="5초 늘리기" onClick={() => update(selected, { seconds: current.seconds + 5 })}>
                        <Plus className="i" aria-hidden />
                      </button>
                    </div>
                    <div className="chips">
                      {[15, 30, 40, 45, 60, 90].map((seconds) => (
                        <button key={seconds} type="button" className={current.seconds === seconds ? "chip on" : "chip"} onClick={() => update(selected, { seconds })}>
                          {seconds}초
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {current.groupKey ? (
                  <div className="two">
                    <div className="field">
                      <span className="label">그룹 이름</span>
                      <input
                        className="input"
                        value={current.groupLabel ?? ""}
                        onChange={(event) => updateGroup(current.groupKey!, { groupLabel: event.target.value })}
                      />
                    </div>
                    <div className="field">
                      <span className="label">반복</span>
                      <div className="stepper">
                        <button
                          type="button"
                          aria-label="반복 줄이기"
                          onClick={() => updateGroup(current.groupKey!, { groupRepeat: Math.max(2, (current.groupRepeat ?? 2) - 1) })}
                        >
                          <Minus className="i" aria-hidden />
                        </button>
                        <span className="v">{current.groupRepeat ?? 1}</span>
                        <button
                          type="button"
                          aria-label="반복 늘리기"
                          onClick={() => updateGroup(current.groupKey!, { groupRepeat: (current.groupRepeat ?? 1) + 1 })}
                        >
                          <Plus className="i" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="insp-foot">
                <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => duplicateStep(selected)}>
                  <Copy className="i" aria-hidden />
                  복제
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ flex: 1 }}
                  disabled={steps.length <= 1}
                  onClick={() => removeStep(selected)}
                >
                  <Trash2 className="i" aria-hidden />
                  삭제
                </button>
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </>
  );
}
