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
  Play,
  Plus,
  Repeat2,
  Send,
  SkipBack,
  SkipForward,
  Timer,
  Trash2,
  Tv,
} from "lucide-react";
import { expand, playTotalSec, type Program as SharedProgram, type ProgramItem, type Step as SharedStep } from "@mvn/shared";
import { ApiError, api } from "@/lib/api";

type Kind = "countdown" | "exercise" | "rest";
type Frame = "exercise" | "next" | "rest";
type Step = {
  kind: Kind;
  label: string;
  subtitle: string | null;
  seconds: number;
  videoId: string | null;
  groupKey: string | null;
  groupLabel: string | null;
  groupRepeat: number | null;
};
type Program = SharedProgram & { totals?: { seconds: number; stepCount: number } };
type VideoItem = { id: string; name: string; url: string; durationSec: number; thumbnailUrl: string; width: number; height: number };
type AudioItem = { id: string; name: string; kind: string; url: string; durationSec: number; mimeType: string };
type VoicePackItem = { id: string; name: string; isDefault: boolean };
type VersionItem = { id: string; version: number; name: string; publishedAt: string; stepCount: number };

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
          videoId: step.videoId ?? null,
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
        videoId: item.videoId ?? null,
        groupKey: null,
        groupLabel: null,
        groupRepeat: null,
      });
    }
  }
  return out;
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

function toSharedProgram(input: {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  publishedVersion: number | null;
  steps: Step[];
}): SharedProgram {
  const items: ProgramItem[] = [];
  let index = 0;
  while (index < input.steps.length) {
    const step = input.steps[index];
    if (!step.groupKey) {
      items.push({
        id: `step-${index}`,
        type: toSharedType(step.kind),
        durationSec: step.seconds,
        label: step.label,
        text: step.subtitle ?? undefined,
        videoId: step.videoId ?? undefined,
      });
      index += 1;
      continue;
    }
    const key = step.groupKey;
    const groupSteps: SharedStep[] = [];
    const start = index;
    while (index < input.steps.length && input.steps[index].groupKey === key) {
      const member = input.steps[index];
      groupSteps.push({
        id: `step-${index}`,
        type: toSharedType(member.kind),
        durationSec: member.seconds,
        label: member.label,
        text: member.subtitle ?? undefined,
        videoId: member.videoId ?? undefined,
      });
      index += 1;
    }
    items.push({
      id: `group-${key}-${start}`,
      type: "group",
      repeat: Math.max(2, step.groupRepeat ?? 2),
      steps: groupSteps,
    });
  }
  return {
    id: input.id || "draft",
    name: input.name || "프로그램",
    status: input.status === "published" ? "published" : "draft",
    draftUpdatedAt: input.updatedAt || new Date().toISOString(),
    publishedVersion: input.publishedVersion,
    skin: {
      id: "neon-arcade",
      options: { pointColor: "#C8F31D", nextLeadSec: 10 },
    },
    items,
  };
}

export function BuilderScreen({ initialId }: { initialId?: string }) {
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
  const [steps, setSteps] = useState<Step[]>([]);
  const [selected, setSelected] = useState(0);
  const [published, setPublished] = useState<number | null>(null);
  const [status, setStatus] = useState("draft");
  const [updatedAt, setUpdatedAt] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [frame, setFrame] = useState<Frame>("next");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [skinFrameOk, setSkinFrameOk] = useState<boolean | null>(null);
  const [videoForm, setVideoForm] = useState({ name: "", url: "", durationSec: 10, thumbnailUrl: "" });
  const dragFrom = useRef<number | null>(null);
  const snapshot = useRef("");
  const saveChain = useRef(Promise.resolve<void>(undefined));
  const previewRef = useRef<HTMLIFrameElement | null>(null);

  function remember(program: Program) {
    setProgramId(program.id);
    setName(program.name);
    setSkinOptions(program.skin.options);
    setPublished(program.publishedVersion);
    setStatus(program.status);
    setUpdatedAt(program.draftUpdatedAt);
    setSavedAt(new Date(program.draftUpdatedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }));
    const next = fromShared(program);
    snapshot.current = JSON.stringify({ name: program.name, skin: program.skin, steps: next });
    setSteps(next);
    setSelected((current) => Math.min(current, Math.max(0, next.length - 1)));
    setEmpty(false);
    setLoading(false);
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [list, videoList, audioList, packList] = await Promise.all([
        api<{ items: Program[] }>("/admin/v1/programs"),
        api<{ items: VideoItem[] }>("/admin/v1/videos"),
        api<{ items: AudioItem[] }>("/admin/v1/audio"),
        api<{ items: VoicePackItem[] }>("/admin/v1/voice-packs"),
      ]);
      setVideos(videoList.items);
      setAudioItems(audioList.items);
      setVoicePacks(packList.items);
      const id = initialId || list.items.find((item) => item.name.includes("머슬핏"))?.id || list.items[0]?.id;
      if (!id) {
        setEmpty(true);
        setLoading(false);
        return;
      }
      remember(await api<Program>(`/admin/v1/programs/${id}`));
    })().catch((caught) => {
      setLoading(false);
      setError(caught instanceof ApiError ? caught.message : "프로그램을 불러오지 못했어요");
    });
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  function persist(nextSteps: Step[], nextName = name, nextSkin = skinOptions) {
    if (!programId) return Promise.resolve(undefined);
    const draftProgram = toSharedProgram({
      id: programId,
      name: nextName,
      status: "draft",
      updatedAt: new Date().toISOString(),
      publishedVersion: published,
      steps: nextSteps,
    });
    draftProgram.skin.options = nextSkin;
    const run = saveChain.current.then(async () => {
      const saved = await api<Program>(`/admin/v1/programs/${programId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: nextName,
          draft: { items: draftProgram.items, skin: draftProgram.skin },
        }),
      });
      setPublished(saved.publishedVersion);
      setStatus(saved.status);
      setUpdatedAt(saved.draftUpdatedAt);
      setSavedAt(new Date(saved.draftUpdatedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }));
      snapshot.current = JSON.stringify({ name: saved.name, skin: saved.skin, steps: fromShared(saved) });
      return saved;
    });
    saveChain.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  useEffect(() => {
    const key = JSON.stringify({ name, skin: { id: "neon-arcade", options: skinOptions }, steps });
    if (!programId || key === snapshot.current) return;
    const timer = window.setTimeout(() => {
      void persist(steps, name, skinOptions)
        .then((saved) => {
          if (saved) setError("");
        })
        .catch((caught) => setError(caught instanceof ApiError ? caught.message : "저장하지 못했어요"));
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, name, skinOptions, programId]);

  useEffect(() => {
    const step = steps[selected];
    if (!step) return;
    setFrame(step.kind === "rest" ? "rest" : step.kind === "countdown" ? "next" : "exercise");
  }, [selected, steps]);

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
    setSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)));
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

  function addStep() {
    setSteps((current) => {
      const next = [
        ...current,
        {
          kind: "exercise" as const,
          label: "새 운동",
          subtitle: "운동",
          seconds: 45,
          videoId: videos[0]?.id ?? null,
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
          kind: "exercise" as const,
          label: "새 운동",
          subtitle: "운동",
          seconds: 45,
          videoId: videos[0]?.id ?? null,
          groupKey: key,
          groupLabel: "새 그룹",
          groupRepeat: 3,
        },
        { kind: "rest" as const, label: "휴식", subtitle: null, seconds: 15, videoId: null, groupKey: key, groupLabel: "새 그룹", groupRepeat: 3 },
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
    if (!programId) return;
    setError("");
    setNotice("");
    const run = saveChain.current.then(async () => {
      await persist(steps, name, skinOptions);
      const result = await api<Program>(`/admin/v1/programs/${programId}/publish`, { method: "POST" });
      setPublished(result.publishedVersion);
      setStatus(result.status);
      setUpdatedAt(result.draftUpdatedAt);
      setSavedAt(new Date(result.draftUpdatedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }));
      snapshot.current = JSON.stringify({ name: result.name, skin: result.skin, steps: fromShared(result) });
      return result;
    });
    saveChain.current = run.then(
      () => undefined,
      () => undefined,
    );
    try {
      const result = await run;
      setNotice(`v${result.publishedVersion}을 발행했어요`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "발행하지 못했어요");
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
            skin: { id: "neon-arcade", options: skinOptions },
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

  async function registerVideo() {
    try {
      const created = await api<VideoItem>("/admin/v1/videos", {
        method: "POST",
        body: JSON.stringify({
          name: videoForm.name || "새 영상",
          url: videoForm.url,
          durationSec: Number(videoForm.durationSec) || 10,
          thumbnailUrl: videoForm.thumbnailUrl || videoForm.url,
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
  const sharedProgram = useMemo(() => {
    const program = toSharedProgram({
      id: programId,
      name,
      status,
      updatedAt: updatedAt || new Date().toISOString(),
      publishedVersion: published,
      steps,
    });
    program.skin.options = skinOptions;
    return program;
  }, [programId, name, status, updatedAt, published, steps, skinOptions]);
  const videoMap = useMemo(() => Object.fromEntries(videos.map((video) => [video.id, video])), [videos]);
  const playItems = useMemo(() => expand(sharedProgram, videoMap), [sharedProgram, videoMap]);
  const total = playTotalSec(playItems);
  const exercise = playItems.filter((item) => item.type === "exercise").reduce((sum, item) => sum + item.durationSec, 0);
  const rest = playItems.filter((item) => item.type === "rest").reduce((sum, item) => sum + item.durationSec, 0);
  const selectedPlayIndex = playItems.findIndex((item) => item.stepId === `step-${selected}`);
  const playElapsed =
    selectedPlayIndex < 0
      ? 0
      : playItems.slice(0, selectedPlayIndex).reduce((sum, item) => sum + item.durationSec, 0) +
        (playItems[selectedPlayIndex]?.durationSec ?? 0) / 2;
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
  const dirtyAfterPublish = published != null && status === "draft";

  useEffect(() => {
    if (!skinFrameOk || !previewRef.current?.contentWindow) return;
    previewRef.current.contentWindow.postMessage(
      {
        type: "mvn:program",
        program: { ...sharedProgram, playItems, videos: videoMap },
      },
      "*",
    );
  }, [sharedProgram, playItems, skinFrameOk, videoMap]);

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
        onClick={() => setSelected(index)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelected(index);
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
          {step.subtitle ? <small>{step.subtitle}</small> : null}
        </div>
        <span className="dur">{clock(step.seconds)}</span>
      </div>
    );
  }

  return (
    <>
      <header className="editbar">
        <a className="icon-btn" href="/" aria-label="대시보드">
          <ArrowLeft className="i" aria-hidden />
        </a>
        <div className="crumbs">
          <span>프로그램</span>
          <ChevronRight className="i" aria-hidden />
        </div>
        <input
          className="title"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="프로그램 이름"
          style={{ border: 0, background: "transparent", width: 180 }}
        />
        <span className="badge badge-warn">
          <span className="dot" />
          {status === "published" ? "게시됨" : "초안"}
        </span>
        {dirtyAfterPublish ? <span className="badge badge-outline">게시 후 수정됨</span> : null}
        <span className="saved">
          <CheckCheck className="i i-sm" aria-hidden />
          {savedAt ? `자동 저장됨 · ${savedAt}` : "불러오는 중"}
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
          <button type="button" className="btn btn-accent btn-sm" onClick={() => void publish()}>
            <Send className="i" aria-hidden />
            발행하기
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
                  {version.stepCount}단계 · neon-arcade ·{" "}
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
            <span className="sel-dark">
              <span style={{ width: 10, height: 10, borderRadius: 3, background: skinOptions.pointColor || "var(--volt-500)" }} />
              neon-arcade
            </span>
          </div>
          <div className="tv-wrap" style={{ alignItems: "center" }}>
            <div className="tv">
              {skinFrameOk ? (
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
                onClick={() => setSelected((currentIndex) => Math.max(0, currentIndex - 1))}
              >
                <SkipBack className="i" aria-hidden />
              </button>
              <button type="button" className="tbtn play" aria-label="재생 미리보기">
                <Play className="i" aria-hidden />
              </button>
              <button
                type="button"
                className="tbtn"
                aria-label="다음 단계"
                onClick={() => setSelected((currentIndex) => Math.min(steps.length - 1, currentIndex + 1))}
              >
                <SkipForward className="i" aria-hidden />
              </button>
              <span className="ttime" style={{ textAlign: "right" }}>
                단계 {steps.length ? selected + 1 : 0}
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
                        if (Number.isFinite(stepIndex)) setSelected(stepIndex);
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
          {current ? (
            <>
              <div className="insp-body">
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
                {current.kind === "exercise" ? (
                  <div className="field">
                    <span className="label">운동 영상</span>
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
                              label: current.label || video?.name || "새 운동",
                            };
                            if (video && !current.seconds) {
                              patch.seconds = video.durationSec;
                            }
                            update(selected, patch);
                          }}
                        >
                          <option value="">영상 선택</option>
                          {videos.map((video) => (
                            <option key={video.id} value={video.id}>
                              {video.name}
                            </option>
                          ))}
                        </select>
                        <small>URL 등록 방식 · GIF→mp4 변환은 나중에</small>
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
                        placeholder="https://…mp4"
                        value={videoForm.url}
                        onChange={(event) => setVideoForm((currentForm) => ({ ...currentForm, url: event.target.value }))}
                      />
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} disabled={!videoForm.url} onClick={() => void registerVideo()}>
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
                <div className="field">
                  <span className="label">{current.kind === "rest" ? "휴식 시간" : current.kind === "countdown" ? "카운트다운" : "운동 시간"}</span>
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
