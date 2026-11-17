"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  HTML_SKIN_SAMPLE_TOKENS,
  HTML_SKIN_TOKENS,
  buildHtmlSkinSrcdoc,
  newHtmlSkinNonce,
} from "@mvn/shared";
import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

export type HtmlSkinRef = {
  id: string;
  slug: string;
  name: string;
  kind?: string;
};

type SkinScreen = {
  id: string;
  title: string;
  html: string;
  css: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
  sortOrder: number;
  version: number;
};

type EditorState = {
  id?: string;
  title: string;
  html: string;
  css: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
};

const emptyEditor = (): EditorState => ({
  title: "새 화면",
  html: `<div data-mvn-video style="width:640px;height:360px;background:#222;border-radius:16px"></div>
<h1 style="font-size:72px;color:{{pointColor}}">{{label}}</h1>
<p style="font-size:48px">{{remainingSec}} / {{totalSec}}</p>`,
  css: "body{background:#0a0e12;color:#fff;font-family:system-ui,sans-serif;padding:48px}",
  hasVideoSlot: true,
  hasNextVideoSlot: false,
  titleOnly: false,
});

export function HtmlSkinPanel({ skin, onNotice, onError }: { skin: HtmlSkinRef; onNotice: (m: string) => void; onError: (m: string) => void }) {
  const [screens, setScreens] = useState<SkinScreen[]>([]);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());
  const [busy, setBusy] = useState(false);
  const [previewNonce] = useState(() => newHtmlSkinNonce());

  const reload = useCallback(async () => {
    const data = await api<{ items: SkinScreen[] }>(`/admin/v1/skins/${skin.id}/screens`);
    setScreens(data.items);
    if (data.items.length && !editor.id) {
      const first = data.items[0];
      setEditor({
        id: first.id,
        title: first.title,
        html: first.html,
        css: first.css,
        hasVideoSlot: first.hasVideoSlot,
        hasNextVideoSlot: first.hasNextVideoSlot,
        titleOnly: first.titleOnly,
      });
    }
  }, [skin.id, editor.id]);

  useEffect(() => {
    void reload().catch((e) => onError(e instanceof ApiError ? e.message : "화면을 불러오지 못했어요"));
  }, [reload, onError]);

  const previewSrcdoc = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return buildHtmlSkinSrcdoc(
      editor.html,
      editor.css,
      { imgSrc: origin, mediaSrc: origin, fontSrc: origin },
      previewNonce,
    );
  }, [editor.css, editor.html, previewNonce]);

  useEffect(() => {
    const iframe = document.getElementById("html-skin-preview-iframe") as HTMLIFrameElement | null;
    if (!iframe?.contentWindow) return;
    const send = () => {
      iframe.contentWindow?.postMessage({ type: "mvn:html-skin-tokens", tokens: HTML_SKIN_SAMPLE_TOKENS }, "*");
    };
    iframe.addEventListener("load", send);
    send();
    return () => iframe.removeEventListener("load", send);
  }, [previewSrcdoc]);

  async function saveScreen() {
    setBusy(true);
    onError("");
    try {
      if (editor.id) {
        await api(`/admin/v1/skins/${skin.id}/screens/${editor.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: editor.title,
            html: editor.html,
            css: editor.css,
            hasVideoSlot: editor.hasVideoSlot,
            hasNextVideoSlot: editor.hasNextVideoSlot,
            titleOnly: editor.titleOnly,
          }),
        });
        onNotice("화면 저장됨 · 이 스킨을 쓰는 프로그램은 재게시 필요");
      } else {
        const created = await api<SkinScreen>(`/admin/v1/skins/${skin.id}/screens`, {
          method: "POST",
          body: JSON.stringify({
            title: editor.title,
            html: editor.html,
            css: editor.css,
            hasVideoSlot: editor.hasVideoSlot,
            hasNextVideoSlot: editor.hasNextVideoSlot,
            titleOnly: editor.titleOnly,
          }),
        });
        setEditor((e) => ({ ...e, id: created.id }));
        onNotice("화면 추가됨");
      }
      await reload();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "저장하지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function removeScreen(id: string) {
    if (!confirm("이 화면을 삭제할까요?")) return;
    setBusy(true);
    try {
      await api(`/admin/v1/skins/${skin.id}/screens/${id}`, { method: "DELETE" });
      await reload();
      if (editor.id === id) setEditor(emptyEditor());
      onNotice("화면 삭제됨");
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "삭제하지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function moveScreen(id: string, dir: -1 | 1) {
    const idx = screens.findIndex((s) => s.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= screens.length) return;
    const order = screens.map((s) => s.id);
    const t = order[idx];
    order[idx] = order[j];
    order[j] = t;
    await api(`/admin/v1/skins/${skin.id}/screens/reorder`, { method: "POST", body: JSON.stringify({ order }) });
    await reload();
  }

  function selectScreen(s: SkinScreen) {
    setEditor({
      id: s.id,
      title: s.title,
      html: s.html,
      css: s.css,
      hasVideoSlot: s.hasVideoSlot,
      hasNextVideoSlot: s.hasNextVideoSlot,
      titleOnly: s.titleOnly,
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="t-h2">HTML 화면</h2>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy}
          onClick={() => setEditor(emptyEditor())}
        >
          <Plus className="i" aria-hidden />
          화면 추가
        </button>
      </div>

      <div className="tpl-grid">
        {screens.map((s, idx) => (
          <div key={s.id} className={editor.id === s.id ? "tpl on" : "tpl"} style={{ cursor: "pointer", padding: 12 }} onClick={() => selectScreen(s)}>
            <b>{s.title}</b>
            <small>
              {s.hasVideoSlot ? "영상" : ""}
              {s.hasNextVideoSlot ? " · 다음영상" : ""}
              {s.titleOnly ? " · 타이틀전용" : ""}
              {` · v${s.version}`}
            </small>
            <div className="row" style={{ gap: 4, marginTop: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy || idx === 0} onClick={(e) => { e.stopPropagation(); void moveScreen(s.id, -1); }}>
                <ChevronUp className="i" aria-hidden />
              </button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy || idx === screens.length - 1} onClick={(e) => { e.stopPropagation(); void moveScreen(s.id, 1); }}>
                <ChevronDown className="i" aria-hidden />
              </button>
              <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={(e) => { e.stopPropagation(); void removeScreen(s.id); }}>
                <Trash2 className="i" aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="skin-layout" style={{ gridTemplateColumns: "1fr 360px" }}>
        <div className="card">
          <div className="card-head">
            <h2 className="t-h2">화면 편집</h2>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveScreen()}>
              <Check className="i" aria-hidden />
              저장
            </button>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 12 }}>
            <input className="input" value={editor.title} onChange={(e) => setEditor((s) => ({ ...s, title: e.target.value }))} placeholder="화면 제목" />
            <label className="row" style={{ gap: 12 }}>
              <input type="checkbox" checked={editor.hasVideoSlot} onChange={(e) => setEditor((s) => ({ ...s, hasVideoSlot: e.target.checked }))} />
              영상 자리
            </label>
            <label className="row" style={{ gap: 12 }}>
              <input type="checkbox" checked={editor.hasNextVideoSlot} onChange={(e) => setEditor((s) => ({ ...s, hasNextVideoSlot: e.target.checked }))} />
              다음 영상 자리
            </label>
            <label className="row" style={{ gap: 12 }}>
              <input type="checkbox" checked={editor.titleOnly} onChange={(e) => setEditor((s) => ({ ...s, titleOnly: e.target.checked }))} />
              타이틀 전용
            </label>
            <div className="field">
              <span className="label">HTML</span>
              <textarea className="input" rows={8} value={editor.html} onChange={(e) => setEditor((s) => ({ ...s, html: e.target.value }))} style={{ fontFamily: "monospace", minHeight: 120 }} />
            </div>
            <div className="field">
              <span className="label">CSS</span>
              <textarea className="input" rows={6} value={editor.css} onChange={(e) => setEditor((s) => ({ ...s, css: e.target.value }))} style={{ fontFamily: "monospace", minHeight: 80 }} />
            </div>
          </div>
        </div>

        <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <div className="card">
            <div className="card-head">
              <h2 className="t-h2">미리보기</h2>
              <span className="badge badge-outline">1920×1080</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <iframe
                id="html-skin-preview-iframe"
                title="HTML 스킨 미리보기"
                sandbox="allow-scripts"
                srcDoc={previewSrcdoc}
                style={{ width: "100%", aspectRatio: "16/9", border: 0, background: "#000" }}
              />
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2 className="t-h2">토큰</h2>
            </div>
            <div className="card-body" style={{ fontFamily: "monospace", fontSize: 12, display: "grid", gap: 4 }}>
              {HTML_SKIN_TOKENS.map((t) => (
                <code key={t}>{`{{${t}}}`}</code>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}