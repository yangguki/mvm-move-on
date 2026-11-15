"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Link as LinkIcon,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";

type VideoItem = {
  id: string;
  name: string;
  url: string;
  durationSec: number;
  thumbnailUrl: string;
  width: number;
  height: number;
  status: "uploading" | "processing" | "ready" | "failed";
  sourceType: "url" | "upload";
  error: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

function clock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  uploading: { label: "업로드 중", color: "#3b82f6" },
  processing: { label: "변환 중", color: "#f59e0b" },
  ready: { label: "준비됨", color: "#22c55e" },
  failed: { label: "실패", color: "#ef4444" },
};

export default function VideosPage() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<VideoItem | null>(null);
  const [urlForm, setUrlForm] = useState({ name: "", url: "", durationSec: 10 });
  const [showUrlForm, setShowUrlForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async () => {
    const res = await api<{ items: VideoItem[] }>("/admin/v1/videos");
    setItems(res.items);
    return res.items;
  }, []);

  useEffect(() => {
    void reload().catch((caught) => {
      setError(caught instanceof ApiError ? caught.message : "영상을 불러오지 못했어요");
    });
  }, [reload]);

  useEffect(() => {
    const hasProcessing = items.some((v) => v.status === "uploading" || v.status === "processing");
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(() => {
        void reload().catch(() => {});
      }, 3000);
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [items, reload]);

  async function uploadFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const ext = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
      if (![".mp4", ".mov", ".webm", ".gif"].includes(ext)) {
        throw new Error("MP4, MOV, WebM, GIF 파일만 업로드할 수 있어요");
      }
      if (file.size > 100 * 1024 * 1024) {
        throw new Error("파일 크기는 100MB 이하여야 해요");
      }
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/v1/videos/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || `HTTP ${res.status}`);
      }
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "업로드에 실패했어요");
    } finally {
      setBusy(false);
    }
  }

  async function registerUrl() {
    setBusy(true);
    setError("");
    try {
      if (!urlForm.url.trim()) throw new Error("URL을 입력해 주세요");
      await api("/admin/v1/videos", {
        method: "POST",
        body: JSON.stringify({
          name: urlForm.name.trim() || "외부 영상",
          url: urlForm.url.trim(),
          durationSec: urlForm.durationSec || 10,
          thumbnailUrl: urlForm.url.trim(),
          width: 1920,
          height: 1080,
        }),
      });
      setUrlForm({ name: "", url: "", durationSec: 10 });
      setShowUrlForm(false);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "등록에 실패했어요");
    } finally {
      setBusy(false);
    }
  }

  async function deleteVideo(id: string) {
    if (!window.confirm("이 영상을 삭제할까요?")) return;
    setError("");
    try {
      await api(`/admin/v1/videos/${id}`, { method: "DELETE" });
      await reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "삭제에 실패했어요");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void uploadFile(file);
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>운동 영상</h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted, #6b7280)", fontSize: 14 }}>
          영상을 업로드하면 자동으로 TV 호환 형식(H.264 mp4)으로 변환됩니다. GIF도 지원합니다.
        </p>
      </header>

      {error && (
        <p style={{ color: "var(--danger, #b91c1c)", marginBottom: 12 }} role="alert">
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: "2px dashed var(--border, #e5e7eb)",
            borderRadius: 8,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: busy ? "wait" : "pointer",
            background: "var(--bg-subtle, #f9fafb)",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="i" aria-hidden />
          <span>파일을 드래그하거나 클릭해서 업로드</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.mov,.webm,.gif"
            hidden
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
              e.target.value = "";
            }}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowUrlForm(!showUrlForm)}
        >
          <LinkIcon className="i i-sm" aria-hidden />
          URL 등록
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void reload()}
          disabled={busy}
        >
          <RefreshCw className="i i-sm" aria-hidden />
          새로고침
        </button>
      </div>

      {showUrlForm && (
        <div
          style={{
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 8,
            padding: 14,
            marginBottom: 16,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label className="label">이름</label>
            <input
              className="input"
              placeholder="영상 이름"
              value={urlForm.name}
              onChange={(e) => setUrlForm({ ...urlForm, name: e.target.value })}
            />
          </div>
          <div className="field" style={{ flex: 2, minWidth: 280 }}>
            <label className="label">URL</label>
            <input
              className="input"
              placeholder="https://..."
              value={urlForm.url}
              onChange={(e) => setUrlForm({ ...urlForm, url: e.target.value })}
            />
          </div>
          <div className="field" style={{ width: 80 }}>
            <label className="label">길이(초)</label>
            <input
              className="input"
              type="number"
              min={1}
              value={urlForm.durationSec}
              onChange={(e) => setUrlForm({ ...urlForm, durationSec: Number(e.target.value) || 10 })}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || !urlForm.url.trim()}
            onClick={() => void registerUrl()}
          >
            <Plus className="i i-sm" aria-hidden />
            등록
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {items.map((video) => {
          const statusInfo = STATUS_LABELS[video.status] || STATUS_LABELS.ready;
          const isProcessing = video.status === "uploading" || video.status === "processing";
          return (
            <div
              key={video.id}
              style={{
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: 8,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <div
                style={{
                  position: "relative",
                  aspectRatio: "16 / 9",
                  background: "#1a1a1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: video.status === "ready" ? "pointer" : "default",
                }}
                onClick={() => video.status === "ready" && setPreview(video)}
              >
                {video.thumbnailUrl && video.status === "ready" ? (
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : isProcessing ? (
                  <Loader2 className="i" style={{ color: statusInfo.color, animation: "spin 1s linear infinite" }} />
                ) : video.status === "failed" ? (
                  <AlertCircle className="i" style={{ color: statusInfo.color }} />
                ) : null}
                {video.status === "ready" && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.3)",
                      opacity: 0,
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                  >
                    <Play className="i" style={{ color: "#fff", width: 32, height: 32 }} />
                  </div>
                )}
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <strong style={{ fontSize: 14, lineHeight: 1.3 }}>{video.name}</strong>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: statusInfo.color + "20",
                      color: statusInfo.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {video.status === "ready" ? (
                      <CheckCircle className="i i-sm" style={{ width: 12, height: 12, marginRight: 2 }} />
                    ) : isProcessing ? (
                      <Clock className="i i-sm" style={{ width: 12, height: 12, marginRight: 2 }} />
                    ) : null}
                    {statusInfo.label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted, #6b7280)", marginTop: 4 }}>
                  {video.status === "ready" && (
                    <>
                      {clock(video.durationSec)} · {video.width}×{video.height}
                      {video.sizeBytes && ` · ${fileSize(video.sizeBytes)}`}
                    </>
                  )}
                  {video.status === "failed" && video.error && (
                    <span style={{ color: "var(--danger, #b91c1c)" }}>{video.error}</span>
                  )}
                  {isProcessing && "처리 중..."}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => void deleteVideo(video.id)}
                  >
                    <Trash2 className="i i-sm" aria-hidden />
                    삭제
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p style={{ color: "var(--muted, #6b7280)", padding: 20 }}>등록된 영상이 없어요.</p>
        )}
      </div>

      {preview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setPreview(null)}
        >
          <div
            style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={preview.url}
              controls
              autoPlay
              loop
              style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 8 }}
            />
            <button
              type="button"
              onClick={() => setPreview(null)}
              style={{
                position: "absolute",
                top: -12,
                right: -12,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "none",
                background: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X className="i i-sm" />
            </button>
            <p style={{ color: "#fff", textAlign: "center", marginTop: 8 }}>
              {preview.name} · {clock(preview.durationSec)} · {preview.width}×{preview.height}
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
