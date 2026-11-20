"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { skinScreenEditPath, skinScreenNewPath } from "@/lib/admin-paths";
import { SkinCardThumbnail, type SkinPreviewScreen } from "../skin-card-thumbnail";
import { SkinScreenCardActions } from "./skin-screen-card-actions";

const NAME_MAX = 60;

type SkinDetail = {
  id: string;
  name: string;
  tone: string;
  kind: string;
  isBuiltin?: boolean;
};

type ConflictBody = {
  message?: string;
  programs?: string[];
  deviceCount?: number;
};

type SkinScreen = {
  id: string;
  title: string;
  html: string;
  css: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
  defaultDurationSec: number | null;
  sortOrder: number;
  version: number;
};

function slotTypeLabel(screen: SkinScreen): string {
  if (screen.titleOnly) return "타이틀";
  if (screen.hasVideoSlot) return "영상";
  if (screen.hasNextVideoSlot) return "다음 영상";
  return "일반";
}

function screenToPreview(screen: SkinScreen): SkinPreviewScreen {
  return {
    id: screen.id,
    title: screen.title,
    html: screen.html,
    css: screen.css,
    hasVideoSlot: screen.hasVideoSlot,
    hasNextVideoSlot: screen.hasNextVideoSlot,
    titleOnly: screen.titleOnly,
    version: screen.version,
  };
}

export function SkinDetailBody({ id }: { id: string }) {
  const router = useRouter();
  const [skin, setSkin] = useState<SkinDetail | null>(null);
  const [screens, setScreens] = useState<SkinScreen[]>([]);
  const [nameDraft, setNameDraft] = useState("");
  const [loadError, setLoadError] = useState("");
  const [screensError, setScreensError] = useState("");
  const [screenActionErrors, setScreenActionErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [skinDeleteError, setSkinDeleteError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingSkin, setDeletingSkin] = useState(false);

  const loadScreens = useCallback(async (skinId: string, kind: string) => {
    if (kind !== "html") {
      setScreens([]);
      return;
    }
    try {
      const data = await api<{ items: SkinScreen[] }>(`/admin/v1/skins/${skinId}/screens`);
      setScreens(data.items);
      setScreensError("");
    } catch (caught) {
      setScreens([]);
      setScreensError(caught instanceof ApiError ? caught.message : "화면을 불러오지 못했어요");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadError("");
      try {
        const detail = await api<SkinDetail>(`/admin/v1/skins/${id}`);
        if (cancelled) return;
        setSkin(detail);
        setNameDraft(detail.name);
        await loadScreens(detail.id, detail.kind);
      } catch (caught) {
        if (!cancelled) setLoadError(caught instanceof ApiError ? caught.message : "스킨을 불러오지 못했어요");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadScreens]);

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!skin) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setSaveError("스킨 이름을 입력해 주세요.");
      return;
    }
    if (trimmed.length > NAME_MAX) {
      setSaveError(`스킨 이름은 ${NAME_MAX}자 이하여야 해요.`);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const updated = await api<SkinDetail>(`/admin/v1/skins/${skin.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      setSkin((prev) => (prev ? { ...prev, name: updated.name } : prev));
      setNameDraft(updated.name);
    } catch (caught) {
      setSaveError(caught instanceof ApiError ? caught.message : "이름을 저장하지 못했어요");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSkin() {
    if (!skin) return;
    if (!window.confirm(`"${skin.name}" 스킨을 삭제할까요?`)) return;
    setSkinDeleteError("");
    setDeletingSkin(true);
    try {
      await api(`/admin/v1/skins/${skin.id}`, { method: "DELETE" });
      router.push("/skins");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        const body = caught.data as ConflictBody | undefined;
        const parts = [caught.message];
        if (body?.programs?.length) parts.push(`프로그램: ${body.programs.join(", ")}`);
        if (body?.deviceCount != null && body.deviceCount > 0) parts.push(`TV ${body.deviceCount}대`);
        setSkinDeleteError(parts.join(" · "));
      } else {
        setSkinDeleteError(caught instanceof ApiError ? caught.message : "스킨을 삭제하지 못했어요");
      }
    } finally {
      setDeletingSkin(false);
    }
  }

  function setScreenActionError(screenId: string, message: string) {
    setScreenActionErrors((prev) => {
      if (!message) {
        const next = { ...prev };
        delete next[screenId];
        return next;
      }
      return { ...prev, [screenId]: message };
    });
  }

  const refreshScreens = useCallback(async () => {
    if (!skin) return;
    await loadScreens(skin.id, skin.kind);
  }, [skin, loadScreens]);

  if (loadError) return <p className="form-error">{loadError}</p>;
  if (!skin) return <p className="subtle">불러오는 중…</p>;

  const nameDirty = nameDraft.trim() !== skin.name;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <article className="card">
        <div className="card-body" style={{ padding: 24 }}>
          <form onSubmit={(event) => void saveName(event)} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
            <div className="field">
              <label className="label" htmlFor="skin-detail-name">
                스킨 이름
              </label>
              <input
                id="skin-detail-name"
                className="input input-lg"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                maxLength={NAME_MAX}
                required
                disabled={saving}
              />
            </div>
            {saveError ? <p className="form-error">{saveError}</p> : null}
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button type="submit" className="btn btn-primary" disabled={saving || !nameDirty}>
                {saving ? "저장 중…" : "저장"}
              </button>
              {!skin.isBuiltin ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deletingSkin || saving}
                  data-testid="skin-delete"
                  aria-label="스킨 삭제"
                  onClick={() => void deleteSkin()}
                >
                  <Trash2 className="i" aria-hidden />
                  스킨 삭제
                </button>
              ) : null}
            </div>
            {skinDeleteError ? <p className="form-error">{skinDeleteError}</p> : null}
          </form>
        </div>
      </article>

      <div>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2 className="t-title" style={{ fontSize: "1.1rem", margin: 0 }}>
            화면
          </h2>
          <Link href={skinScreenNewPath(skin.id)} className="btn btn-secondary">
            <Plus className="i" aria-hidden />
            화면 추가
          </Link>
        </div>
        {screensError ? <p className="form-error">{screensError}</p> : null}
        {skin.kind !== "html" ? (
          <p className="subtle">토큰 스킨은 HTML 화면 목록이 없어요.</p>
        ) : screens.length === 0 ? (
          <p className="subtle">등록된 화면이 없어요. 「화면 추가」로 첫 화면을 만들 수 있어요.</p>
        ) : (
          <div className="tpl-grid">
            {screens.map((screen, index) => (
              <div key={screen.id} className="tpl" style={{ cursor: "default" }}>
                <Link
                  href={skinScreenEditPath(skin.id, screen.id)}
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
                >
                  <SkinCardThumbnail
                    previewScreen={screenToPreview(screen)}
                    tone={skin.tone}
                    name={screen.title}
                  />
                  <div className="tpl-meta">
                    <strong>{screen.title}</strong>
                    <span className="subtle" style={{ display: "block", marginTop: 4 }}>
                      슬롯: {slotTypeLabel(screen)}
                    </span>
                    {screen.defaultDurationSec != null ? (
                      <span className="subtle" style={{ display: "block", marginTop: 4 }}>
                        기본 시간: {screen.defaultDurationSec}초
                      </span>
                    ) : null}
                  </div>
                </Link>
                <SkinScreenCardActions
                  skinId={skin.id}
                  screenId={screen.id}
                  index={index}
                  total={screens.length}
                  onRefresh={refreshScreens}
                  onError={(message) => setScreenActionError(screen.id, message)}
                />
                {screenActionErrors[screen.id] ? (
                  <p className="form-error" style={{ margin: "8px 4px 0", fontSize: 12 }}>
                    {screenActionErrors[screen.id]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}