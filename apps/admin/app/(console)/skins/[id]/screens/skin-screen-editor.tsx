"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, api } from "@/lib/api";
import { SkinCardThumbnail, type SkinPreviewScreen } from "../../skin-card-thumbnail";

const TITLE_MAX = 60;
const DURATION_MIN = 1;
const DURATION_MAX = 3600;
const PREVIEW_DEBOUNCE_MS = 300;

export type SkinScreenSlotType = "video" | "nextVideo" | "titleOnly";

type SkinScreenApi = {
  id: string;
  title: string;
  html: string;
  css: string;
  slotType?: SkinScreenSlotType | null;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
  defaultDurationSec: number | null;
};

const SLOT_OPTIONS: { value: SkinScreenSlotType; label: string }[] = [
  { value: "video", label: "영상" },
  { value: "nextVideo", label: "다음 영상" },
  { value: "titleOnly", label: "제목만" },
];

function slotFlagsFromType(slotType: SkinScreenSlotType) {
  return {
    hasVideoSlot: slotType === "video",
    hasNextVideoSlot: slotType === "nextVideo",
    titleOnly: slotType === "titleOnly",
  };
}

function inferSlotType(screen: Pick<SkinScreenApi, "slotType" | "hasVideoSlot" | "hasNextVideoSlot" | "titleOnly">): SkinScreenSlotType {
  if (screen.slotType) return screen.slotType;
  if (screen.titleOnly) return "titleOnly";
  if (screen.hasVideoSlot) return "video";
  if (screen.hasNextVideoSlot) return "nextVideo";
  return "video";
}

const defaultDraft = () => ({
  title: "",
  html: `<div data-mvn-video style="width:640px;height:360px;background:#222;border-radius:16px"></div>
<h1 style="font-size:72px;color:{{pointColor}}">{{label}}</h1>
<p style="font-size:48px">{{remainingSec}} / {{totalSec}}</p>`,
  css: "body{background:#0a0e12;color:#fff;font-family:system-ui,sans-serif;padding:48px}",
  slotType: "video" as SkinScreenSlotType,
  defaultDurationSec: "",
});

function parseDurationField(raw: string): { value: number | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < DURATION_MIN || n > DURATION_MAX) {
    return { value: null, error: `기본 시간은 ${DURATION_MIN}~${DURATION_MAX}초 정수이거나 비워 두세요.` };
  }
  return { value: n };
}

export function SkinScreenEditor({ skinId, screenId }: { skinId: string; screenId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(screenId);
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [slotType, setSlotType] = useState<SkinScreenSlotType>("video");
  const [defaultDurationSec, setDefaultDurationSec] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const [previewDraft, setPreviewDraft] = useState({
    title: "",
    html: "",
    css: "",
    slotType: "video" as SkinScreenSlotType,
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPreviewDraft({ title, html, css, slotType });
    }, PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [title, html, css, slotType]);

  const loadScreen = useCallback(async () => {
    if (!screenId) return;
    setLoading(true);
    setLoadError("");
    try {
      const data = await api<SkinScreenApi>(`/admin/v1/skins/${skinId}/screens/${screenId}`);
      setTitle(data.title);
      setHtml(data.html);
      setCss(data.css);
      setSlotType(inferSlotType(data));
      setDefaultDurationSec(data.defaultDurationSec == null ? "" : String(data.defaultDurationSec));
      setPreviewDraft({
        title: data.title,
        html: data.html,
        css: data.css,
        slotType: inferSlotType(data),
      });
    } catch (caught) {
      setLoadError(caught instanceof ApiError ? caught.message : "화면을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, [screenId, skinId]);

  useEffect(() => {
    if (isEdit) void loadScreen();
    else {
      const draft = defaultDraft();
      setTitle(draft.title);
      setHtml(draft.html);
      setCss(draft.css);
      setSlotType(draft.slotType);
      setDefaultDurationSec(draft.defaultDurationSec);
      setPreviewDraft({
        title: draft.title,
        html: draft.html,
        css: draft.css,
        slotType: draft.slotType,
      });
    }
  }, [isEdit, loadScreen]);

  const previewScreen = useMemo((): SkinPreviewScreen => {
    const flags = slotFlagsFromType(previewDraft.slotType);
    return {
      id: screenId ?? "draft-preview",
      title: previewDraft.title || "미리보기",
      html: previewDraft.html,
      css: previewDraft.css,
      ...flags,
      version: 1,
    };
  }, [previewDraft, screenId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setSaveError("이름을 입력해 주세요.");
      return;
    }
    if (trimmedTitle.length > TITLE_MAX) {
      setSaveError(`이름은 ${TITLE_MAX}자 이하여야 해요.`);
      return;
    }
    const duration = parseDurationField(defaultDurationSec);
    if (duration.error) {
      setSaveError(duration.error);
      return;
    }
    setSaving(true);
    setSaveError("");
    const body = {
      title: trimmedTitle,
      html,
      css,
      slotType,
      defaultDurationSec: duration.value,
    };
    try {
      if (isEdit && screenId) {
        await api(`/admin/v1/skins/${skinId}/screens/${screenId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api(`/admin/v1/skins/${skinId}/screens`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      router.push(`/skins/${skinId}`);
    } catch (caught) {
      setSaveError(caught instanceof ApiError ? caught.message : "저장하지 못했어요");
      setSaving(false);
    }
  }

  if (loading) return <p className="subtle">불러오는 중…</p>;
  if (loadError) return <p className="form-error">{loadError}</p>;

  return (
    <form onSubmit={(event) => void save(event)} className="skin-layout" style={{ alignItems: "start" }}>
      <div className="card" style={{ display: "grid", gap: 0 }}>
        <div className="card-body" style={{ padding: 24, display: "grid", gap: 16 }}>
          <div className="field">
            <label className="label" htmlFor="screen-title">
              이름
            </label>
            <input
              id="screen-title"
              className="input input-lg"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={TITLE_MAX}
              required
              disabled={saving}
              placeholder="화면 이름"
            />
          </div>

          <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="label">슬롯 유형</legend>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label="슬롯 유형">
              {SLOT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={slotType === option.value ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                  style={{ cursor: saving ? "default" : "pointer" }}
                >
                  <input
                    type="radio"
                    name="slotType"
                    value={option.value}
                    checked={slotType === option.value}
                    disabled={saving}
                    onChange={() => setSlotType(option.value)}
                    style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label className="label" htmlFor="screen-duration">
              기본 시간 (초)
            </label>
            <input
              id="screen-duration"
              className="input"
              type="number"
              min={DURATION_MIN}
              max={DURATION_MAX}
              step={1}
              value={defaultDurationSec}
              onChange={(event) => setDefaultDurationSec(event.target.value)}
              disabled={saving}
              placeholder="비우면 기본값 없음"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="screen-html">
              HTML
            </label>
            <textarea
              id="screen-html"
              className="input"
              rows={10}
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              disabled={saving}
              style={{ fontFamily: "monospace", minHeight: 160 }}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="screen-css">
              CSS
            </label>
            <textarea
              id="screen-css"
              className="input"
              rows={8}
              value={css}
              onChange={(event) => setCss(event.target.value)}
              disabled={saving}
              style={{ fontFamily: "monospace", minHeight: 120 }}
            />
          </div>

          {saveError ? <p className="form-error">{saveError}</p> : null}

          <div className="row" style={{ gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "저장 중…" : "저장"}
            </button>
            <Link href={`/skins/${skinId}`} className="btn btn-secondary">
              취소
            </Link>
          </div>
        </div>
      </div>

      <aside style={{ display: "grid", gap: 12, alignContent: "start", width: "100%" }}>
        <div className="card">
          <div className="card-head">
            <h2 className="t-h2">미리보기</h2>
            <span className="badge badge-outline">1920×1080</span>
          </div>
          <div className="card-body preview" style={{ padding: 8 }}>
            <SkinCardThumbnail previewScreen={previewScreen} tone="#0a0e12" name={previewScreen.title ?? "미리보기"} />
          </div>
        </div>
      </aside>
    </form>
  );
}