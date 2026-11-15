"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Check, Eye, EyeOff, Trash2 } from "lucide-react";

type SkinTokens = Record<string, unknown>;

type SkinItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tone: string;
  thumbnailUrl: string | null;
  tokens: SkinTokens;
  isActive: boolean;
  isBuiltin: boolean;
  storeCount: number;
  usedInPrograms: string[];
};

type PreviewState = "countdown" | "exercise" | "rest" | "complete";

const PREVIEW_STATES: Array<{ id: PreviewState; label: string }> = [
  { id: "countdown", label: "카운트다운" },
  { id: "exercise", label: "운동" },
  { id: "rest", label: "휴식" },
  { id: "complete", label: "완료" },
];

const COLORS = ["#00F0FF", "#C8F31D", "#FF4FA8", "#FFB020", "#7C5CFF", "#FF5722", "#E11D2E", "#FFD93D"];

function makeDemoProgram(tokens: SkinTokens, state: PreviewState) {
  const restLabel = (tokens.countdownLabel as string) || "REST";
  const completeLabel = (tokens.completeLabel as string) || "COMPLETE!";
  const items =
    state === "countdown"
      ? [{ id: "g1", type: "guide", durationSec: 999, label: "준비", text: "시작 준비" }]
      : state === "exercise"
        ? [{ id: "e1", type: "exercise", durationSec: 999, label: "숄더 프레스", videoId: "v1" }]
        : state === "rest"
          ? [{ id: "r1", type: "rest", durationSec: 999, label: restLabel }]
          : [{ id: "c1", type: "guide", durationSec: 999, label: completeLabel, text: "운동 완료" }];

  return {
    id: "skin-preview",
    name: "스킨 미리보기",
    status: "draft",
    draftUpdatedAt: new Date().toISOString(),
    publishedVersion: null,
    skin: {
      id: (tokens.theme as string) || "neon-arcade",
      options: { pointColor: (tokens.accent as string) || "#C8F31D", nextLeadSec: 0 },
      tokens,
    },
    items,
    videos: {
      v1: {
        id: "v1",
        name: "숄더 프레스",
        url: "/skins/neon-arcade/mvn_shoulder_press.mp4",
        durationSec: 3,
        thumbnailUrl: "/skins/neon-arcade/rest_image.jpg",
        width: 1920,
        height: 1080,
      },
    },
  };
}

export function SkinsView() {
  const [skins, setSkins] = useState<SkinItem[]>([]);
  const [selected, setSelected] = useState<SkinItem | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>("exercise");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editTokens, setEditTokens] = useState<SkinTokens>({});
  const previewRef = useRef<HTMLIFrameElement | null>(null);

  const reload = useCallback(async () => {
    const data = await api<{ items: SkinItem[] }>("/admin/v1/skins");
    setSkins(data.items);
    if (!selected && data.items.length > 0) {
      setSelected(data.items[0]);
      setEditTokens(data.items[0].tokens);
    }
  }, [selected]);

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof ApiError ? e.message : "스킨을 불러오지 못했어요"));
  }, [reload]);

  useEffect(() => {
    if (!previewRef.current?.contentWindow || !selected) return;
    const program = makeDemoProgram(editTokens, previewState);
    previewRef.current.contentWindow.postMessage({ type: "mvn:program", program, loop: true }, "*");
  }, [editTokens, previewState, selected]);

  function selectSkin(skin: SkinItem) {
    setSelected(skin);
    setEditTokens(skin.tokens);
    setError("");
    setNotice("");
  }

  async function toggleActive(skin: SkinItem) {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/v1/skins/${skin.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !skin.isActive }),
      });
      await reload();
      setNotice(skin.isActive ? `${skin.name} 비활성화됨` : `${skin.name} 활성화됨`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "변경하지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSkin(skin: SkinItem) {
    if (!confirm(`${skin.name} 스킨을 삭제할까요?`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/v1/skins/${skin.id}`, { method: "DELETE" });
      await reload();
      setNotice(`${skin.name} 삭제됨`);
      if (selected?.id === skin.id) {
        setSelected(skins.find((s) => s.id !== skin.id) || null);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const data = e.data as { programs?: string[]; deviceCount?: number };
        const msg = data.programs?.length
          ? `${skin.name}은 ${data.programs.join(", ")}에서 사용 중이에요`
          : `${skin.name}은 ${data.deviceCount ?? 0}개 기기에서 사용 중이에요`;
        setError(msg);
      } else {
        setError(e instanceof ApiError ? e.message : "삭제하지 못했어요");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveTokens() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/v1/skins/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ tokens: editTokens }),
      });
      await reload();
      setNotice("저장됨 (이 스킨을 쓰는 프로그램은 재게시 필요)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "저장하지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  function sendPreviewProgram() {
    if (!previewRef.current?.contentWindow || !selected) return;
    const program = makeDemoProgram(editTokens, previewState);
    previewRef.current.contentWindow.postMessage({ type: "mvn:program", program, loop: true }, "*");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="t-title">스킨</h1>
          <p>TV 화면 테마를 고르고 강조 색·로고·휴식 이미지·BGM만 바꿔요. 화면 구성은 템플릿이 지켜줘요.</p>
        </div>
        <div className="row">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveTokens()}>
            <Check className="i" aria-hidden />
            저장하고 적용
          </button>
        </div>
      </div>
      {error ? <p className="form-error" style={{ marginTop: -8 }}>{error}</p> : null}
      {notice ? <p className="pair-box" style={{ marginTop: -8 }}>{notice}</p> : null}
      <div className="skin-layout">
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <article className="card">
            <div className="card-head" style={{ minHeight: 52, padding: "12px 20px" }}>
              <div className="row" style={{ gap: 12 }}>
                <h2 className="t-h2">미리보기</h2>
                <span className="badge badge-outline">1920×1080</span>
              </div>
              <div className="seg">
                {PREVIEW_STATES.map(({ id, label }) => (
                  <button key={id} type="button" className={previewState === id ? "on" : undefined} onClick={() => setPreviewState(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body" style={{ padding: "0 20px 20px" }}>
              <div className="preview" style={{ background: "#000", borderRadius: 8, overflow: "hidden" }}>
                {selected ? (
                  <iframe
                    ref={previewRef}
                    title={`${selected.name} 미리보기`}
                    src="/skins/neon-arcade/index.html"
                    style={{ width: "100%", aspectRatio: "16/9", border: 0, display: "block" }}
                    onLoad={sendPreviewProgram}
                  />
                ) : (
                  <div style={{ aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p className="subtle">스킨을 선택하세요</p>
                  </div>
                )}
              </div>
            </div>
          </article>
          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <h2 className="t-h2">
                스킨 <span className="subtle" style={{ fontWeight: 500 }}>{skins.length}</span>
              </h2>
              <span className="t-sm subtle">스킨을 바꿔도 프로그램은 재게시 필요</span>
            </div>
            <div className="tpl-grid">
              {skins.map((skin) => (
                <button
                  key={skin.id}
                  type="button"
                  className={skin.id === selected?.id ? "tpl on" : "tpl"}
                  onClick={() => selectSkin(skin)}
                  style={{ opacity: skin.isActive ? 1 : 0.5 }}
                >
                  <div className="shot" style={{ background: skin.tone, borderRadius: 8, aspectRatio: "16/9" }}>
                    <span style={{ fontSize: 11, color: "#fff", textShadow: "0 1px 2px #000", padding: 4 }}>{skin.name}</span>
                  </div>
                  {skin.id === selected?.id ? (
                    <span className="sel-mark">
                      <Check className="i" style={{ width: 12, height: 12 }} strokeWidth={3} aria-hidden />
                    </span>
                  ) : null}
                  <b>{skin.name}</b>
                  <small>
                    {skin.storeCount > 0 ? `${skin.storeCount}개 기기` : "기기 없음"}
                    {skin.usedInPrograms.length > 0 ? ` · ${skin.usedInPrograms.length}개 프로그램` : ""}
                    {!skin.isActive ? " · 비활성" : ""}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head" style={{ minHeight: 52, padding: "12px 20px" }}>
            <h2 className="t-h2">꾸미기</h2>
            {selected ? (
              <span className="badge badge-volt">
                <span className="dot" />
                {selected.name}
              </span>
            ) : null}
          </div>
          {selected ? (
            <div className="card-body" style={{ padding: "4px 20px 20px", display: "grid", gap: 16 }}>
              <div className="field">
                <span className="label">강조 색 (accent)</span>
                <div className="swatches">
                  {COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={editTokens.accent === hex ? "sw on" : "sw"}
                      style={{ background: hex }}
                      aria-label={hex}
                      onClick={() => setEditTokens((t) => ({ ...t, accent: hex }))}
                    />
                  ))}
                </div>
                <input
                  className="input"
                  value={(editTokens.accent as string) || ""}
                  onChange={(e) => setEditTokens((t) => ({ ...t, accent: e.target.value }))}
                  placeholder="#C8F31D"
                  style={{ marginTop: 8, maxWidth: 120 }}
                />
              </div>
              <div className="field">
                <span className="label">배경색</span>
                <input
                  className="input"
                  value={(editTokens.background as string) || ""}
                  onChange={(e) => setEditTokens((t) => ({ ...t, background: e.target.value }))}
                  placeholder="#0A0E12"
                  style={{ maxWidth: 120 }}
                />
              </div>
              <div className="field">
                <span className="label">영상 모서리</span>
                <input
                  type="number"
                  className="input"
                  value={(editTokens.videoRadius as number) ?? ""}
                  onChange={(e) => setEditTokens((t) => ({ ...t, videoRadius: Number(e.target.value) || 0 }))}
                  placeholder="24"
                  style={{ maxWidth: 80 }}
                />
                <span className="hint">px</span>
              </div>
              <div className="field">
                <span className="label">폰트</span>
                <input
                  className="input"
                  value={(editTokens.fontFamily as string) || ""}
                  onChange={(e) => setEditTokens((t) => ({ ...t, fontFamily: e.target.value }))}
                  placeholder="system-ui, sans-serif"
                />
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--border)" }} />
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void toggleActive(selected)}>
                  {selected.isActive ? <EyeOff className="i" aria-hidden /> : <Eye className="i" aria-hidden />}
                  {selected.isActive ? "비활성화" : "활성화"}
                </button>
                {!selected.isBuiltin ? (
                  <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => void deleteSkin(selected)}>
                    <Trash2 className="i" aria-hidden />
                    삭제
                  </button>
                ) : (
                  <span className="t-sm subtle">기본 스킨은 삭제 불가</span>
                )}
              </div>
            </div>
          ) : (
            <div className="card-body" style={{ padding: 20 }}>
              <p className="subtle">스킨을 선택하세요</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
