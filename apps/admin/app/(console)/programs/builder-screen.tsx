"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Cast, CheckCheck, ChevronDown, ChevronRight, Coffee, GripVertical, Play, Plus, Repeat2, Send, Timer } from "lucide-react";
import { ApiError, api } from "@/lib/api";

type Kind = "countdown" | "exercise" | "rest";
type Step = {
  kind: Kind;
  label: string;
  subtitle: string | null;
  seconds: number;
  groupKey: string | null;
  groupLabel: string | null;
  groupRepeat: number | null;
};
type Program = {
  id: string;
  name: string;
  status: string;
  lockVersion: number;
  draftVersion: number;
  publishedVersion: number | null;
  updatedAt: string;
  skin: { id: string; name: string; tone: string };
  totals: { seconds: number; exerciseSeconds: number; restSeconds: number };
  steps: Array<Step & { group: { key: string; label: string | null; repeat: number | null } | null }>;
};

function clock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function fromApi(program: Program): Step[] {
  return program.steps.map((step) => ({
    kind: step.kind,
    label: step.label,
    subtitle: step.subtitle,
    seconds: step.seconds,
    groupKey: step.group?.key ?? null,
    groupLabel: step.group?.label ?? null,
    groupRepeat: step.group?.repeat ?? null,
  }));
}

export function BuilderScreen({ initialId }: { initialId?: string }) {
  const [programId, setProgramId] = useState(initialId ?? "");
  const [name, setName] = useState("");
  const [skinId, setSkinId] = useState("");
  const [skinName, setSkinName] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState(1);
  const [published, setPublished] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lockRef = useRef(1);
  const dragFrom = useRef<number | null>(null);
  const snapshot = useRef("");

  function remember(program: Program) {
    lockRef.current = program.lockVersion;
    setProgramId(program.id);
    setName(program.name);
    setSkinId(program.skin.id);
    setSkinName(program.skin.name);
    setDraft(program.draftVersion);
    setPublished(program.publishedVersion);
    setSavedAt(new Date(program.updatedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }));
    const next = fromApi(program);
    snapshot.current = JSON.stringify(next);
    setSteps(next);
  }

  useEffect(() => {
    void (async () => {
      const list = await api<{ items: Array<{ id: string; name: string }> }>("/admin/v1/programs");
      const id = initialId || list.items.find((item) => item.name.includes("머슬핏"))?.id || list.items[0]?.id;
      if (!id) return;
      remember(await api<Program>(`/admin/v1/programs/${id}`));
    })().catch((caught) => setError(caught instanceof ApiError ? caught.message : "프로그램을 불러오지 못했어요"));
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  async function persist(nextSteps: Step[], nextName = name) {
    if (!programId) return;
    const saved = await api<Program>(`/admin/v1/programs/${programId}`, {
      method: "PUT",
      headers: { "If-Match": `"${lockRef.current}"` },
      body: JSON.stringify({
        name: nextName,
        skinId,
        steps: nextSteps.map((step) => ({
          kind: step.kind,
          label: step.label,
          subtitle: step.subtitle,
          seconds: step.seconds,
          groupKey: step.groupKey,
          groupLabel: step.groupLabel,
          groupRepeat: step.groupRepeat,
        })),
      }),
    });
    lockRef.current = saved.lockVersion;
    setDraft(saved.draftVersion);
    setPublished(saved.publishedVersion);
    setSavedAt(new Date(saved.updatedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }));
  }

  useEffect(() => {
    const key = JSON.stringify(steps);
    if (!programId || key === snapshot.current) return;
    const timer = window.setTimeout(() => {
      snapshot.current = key;
      void persist(steps).catch((caught) => setError(caught instanceof ApiError ? caught.message : "저장하지 못했어요"));
    }, 700);
    return () => window.clearTimeout(timer);
    // steps 변경만 저장해요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, programId]);

  function update(index: number, patch: Partial<Step>) {
    setSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)));
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

  async function publish() {
    setError("");
    try {
      await persist(steps);
      const result = await api<Program>(`/admin/v1/programs/${programId}/publish`, {
        method: "POST",
        headers: { "If-Match": `"${lockRef.current}"` },
      });
      lockRef.current = result.lockVersion;
      setDraft(result.draftVersion);
      setPublished(result.publishedVersion);
      setNotice(`v${result.publishedVersion}을 발행했어요`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "발행하지 못했어요");
    }
  }

  const current = steps[selected];
  const exercise = steps.filter((step) => step.kind === "exercise").reduce((sum, step) => sum + step.seconds, 0);
  const rest = steps.filter((step) => step.kind === "rest").reduce((sum, step) => sum + step.seconds, 0);
  const total = steps.reduce((sum, step) => sum + step.seconds, 0);

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
        <input className="title" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => void persist(steps, name)} aria-label="프로그램 이름" style={{ border: 0, background: "transparent", width: 180 }} />
        <span className="badge badge-warn">
          <span className="dot" />
          초안 v{draft}
        </span>
        <span className="saved">
          <CheckCheck className="i i-sm" aria-hidden />
          {savedAt ? `저장됨 · ${savedAt}` : "불러오는 중"}
        </span>
        <div className="row" style={{ marginLeft: "auto" }}>
          <span className="t-sm subtle" style={{ marginRight: 4 }}>
            {published ? `발행본 v${published}` : "아직 발행 전이에요"}
          </span>
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
      {error ? <p className="form-error" style={{ margin: "8px 16px 0" }}>{error}</p> : null}
      {notice ? <p className="pair-box" style={{ margin: "8px 16px 0" }}>{notice}</p> : null}
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
            {steps.map((step, index) => {
              const head = step.groupKey && steps[index - 1]?.groupKey !== step.groupKey;
              return (
                <div key={`${step.label}-${index}`}>
                  {head ? (
                    <div className="group-head">
                      <ChevronDown className="i i-sm" aria-hidden />
                      {step.groupLabel}
                      <span className="rep">
                        <Repeat2 className="i i-sm" style={{ width: 11, height: 11 }} aria-hidden />
                        {step.groupRepeat ?? 1}
                      </span>
                    </div>
                  ) : null}
                  <div
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
                  >
                    <GripVertical className="i grip" aria-hidden />
                    <span className="n">{index + 1}</span>
                    <span className={`ty ${step.kind === "countdown" ? "ty-c" : step.kind === "rest" ? "ty-r" : "ty-e"}`}>
                      {step.kind === "rest" ? <Coffee className="i i-sm" aria-hidden /> : step.kind === "countdown" ? <Timer className="i i-sm" aria-hidden /> : <Play className="i i-sm" aria-hidden />}
                    </span>
                    <div className="nm">
                      <b>{step.label}</b>
                      {step.subtitle ? <small>{step.subtitle}</small> : null}
                    </div>
                    <span className="dur">{clock(step.seconds)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="add-row">
            <button
              type="button"
              className="btn btn-sm btn-dashed"
              onClick={() => {
                setSteps((current) => [...current, { kind: "exercise", label: "새 운동", subtitle: "운동", seconds: 45, groupKey: null, groupLabel: null, groupRepeat: null }]);
                setSelected(steps.length);
              }}
            >
              <Plus className="i" aria-hidden />
              단계 추가
            </button>
          </div>
        </section>
        <section className="stage">
          <div className="stage-bar">
            <span className="lbl">TV 미리보기 · {skinName}</span>
            <span className="sel-dark" style={{ marginLeft: "auto" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--volt-500)" }} />
              {current?.label ?? "단계"}
            </span>
          </div>
          <div className="tv-wrap">
            <div className="tv">
              <img src="/media/skin-neon-next.jpg" alt="TV 화면 미리보기" />
            </div>
          </div>
          <div className="timeline">
            <div className="tl-head">
              <span>타임라인 · {clock(total)}</span>
            </div>
            <div className="tl-track">
              {steps.map((step, index) => (
                <i key={`${step.label}-${index}`} className={index === selected ? "seg-e sel" : step.kind === "countdown" ? "seg-c" : step.kind === "rest" ? "seg-r" : "seg-e"} style={{ flex: step.seconds }} />
              ))}
            </div>
          </div>
        </section>
        <aside className="insp">
          <div className="panel-head">
            <div>
              <h2>단계 설정</h2>
              <small>
                {selected + 1} / {steps.length}
              </small>
            </div>
          </div>
          {current ? (
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
              <div className="field">
                <span className="label">TV 표시 이름</span>
                <input className="input" value={current.label} onChange={(event) => update(selected, { label: event.target.value })} />
              </div>
              <div className="field">
                <span className="label">{current.kind === "rest" ? "휴식 시간" : "운동 시간"}</span>
                <div className="chips">
                  {[15, 30, 40, 45, 60, 90].map((seconds) => (
                    <button key={seconds} type="button" className={current.seconds === seconds ? "chip on" : "chip"} onClick={() => update(selected, { seconds })}>
                      {seconds}초
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
