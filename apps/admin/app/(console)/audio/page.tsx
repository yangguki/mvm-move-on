"use client";

import { useCallback, useEffect, useState } from "react";
import { Music2, Mic2, Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";

type AudioItem = {
  id: string;
  name: string;
  kind: "music" | "voice" | string;
  url: string;
  durationSec: number;
  mimeType: string;
  createdAt: string;
};

type VoicePack = {
  id: string;
  name: string;
  isDefault: boolean;
  cues: Record<string, string>;
  createdAt: string;
};

const CUE_LABELS: Array<{ key: string; label: string }> = [
  { key: "countdown5", label: "카운트 5" },
  { key: "countdown4", label: "카운트 4" },
  { key: "countdown3", label: "카운트 3" },
  { key: "countdown2", label: "카운트 2" },
  { key: "countdown1", label: "카운트 1" },
  { key: "restStart", label: "휴식 시작" },
];

function clock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function AudioPage() {
  const [tab, setTab] = useState<"music" | "voice">("music");
  const [items, setItems] = useState<AudioItem[]>([]);
  const [packs, setPacks] = useState<VoicePack[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [packName, setPackName] = useState("새 음성 팩");
  const [cues, setCues] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const [audio, voice] = await Promise.all([
      api<{ items: AudioItem[] }>("/admin/v1/audio"),
      api<{ items: VoicePack[] }>("/admin/v1/voice-packs"),
    ]);
    setItems(audio.items);
    setPacks(voice.items);
    const def = voice.items.find((p) => p.isDefault) || voice.items[0];
    if (def) {
      setCues(def.cues);
      setPackName(def.name);
    }
  }, []);

  useEffect(() => {
    void reload().catch((caught) => {
      setError(caught instanceof ApiError ? caught.message : "오디오를 불러오지 못했어요");
    });
  }, [reload]);

  async function uploadFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const mimeType = file.type || (file.name.endsWith(".m4a") ? "audio/mp4" : "audio/mpeg");
      if (!/mp3|mpeg|m4a|mp4/i.test(mimeType) && !/\.(mp3|m4a)$/i.test(file.name)) {
        throw new Error("MP3/M4A만 업로드할 수 있어요");
      }
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const dataBase64 = btoa(binary);
      const durationSec = await new Promise<number>((resolve) => {
        const audio = new Audio();
        audio.preload = "metadata";
        audio.onloadedmetadata = () => {
          resolve(Number.isFinite(audio.duration) ? Math.max(1, Math.round(audio.duration)) : 1);
          URL.revokeObjectURL(audio.src);
        };
        audio.onerror = () => {
          resolve(1);
          URL.revokeObjectURL(audio.src);
        };
        audio.src = URL.createObjectURL(file);
      });
      await api("/admin/v1/audio", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || file.name.replace(/\.[^.]+$/, ""),
          kind: tab === "music" ? "music" : "voice",
          mimeType: mimeType.includes("m4a") || mimeType.includes("mp4") ? "audio/mp4" : "audio/mpeg",
          durationSec,
          dataBase64,
        }),
      });
      setName("");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "업로드에 실패했어요");
    } finally {
      setBusy(false);
    }
  }

  async function savePack() {
    setBusy(true);
    setError("");
    try {
      const missing = CUE_LABELS.find(({ key }) => !cues[key]);
      if (missing) throw new Error(`${missing.label} 음성을 선택해 주세요`);
      await api("/admin/v1/voice-packs", {
        method: "POST",
        body: JSON.stringify({ name: packName.trim() || "음성 팩", isDefault: packs.length === 0, cues }),
      });
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "음성 팩 저장에 실패했어요");
    } finally {
      setBusy(false);
    }
  }

  const list = items.filter((item) => (tab === "music" ? item.kind === "music" : item.kind === "voice"));
  const voices = items.filter((item) => item.kind === "voice");

  return (
    <div style={{ padding: "24px 28px", maxWidth: 960 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>오디오 라이브러리</h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted, #6b7280)", fontSize: 14 }}>
          배경음악과 음성 팩을 관리합니다. 업로드는 MP3/M4A만 가능합니다.
        </p>
      </header>

      <div className="seg" style={{ marginBottom: 16, display: "inline-flex" }}>
        <button type="button" className={tab === "music" ? "on" : undefined} onClick={() => setTab("music")}>
          <Music2 className="i i-sm" aria-hidden /> 배경음악
        </button>
        <button type="button" className={tab === "voice" ? "on" : undefined} onClick={() => setTab("voice")}>
          <Mic2 className="i i-sm" aria-hidden /> 음성 팩
        </button>
      </div>

      {error ? (
        <p style={{ color: "var(--danger, #b91c1c)", marginBottom: 12 }} role="alert">
          {error}
        </p>
      ) : null}

      {tab === "music" ? (
        <section>
          <div className="field" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <input className="input" style={{ maxWidth: 240 }} placeholder="이름 (선택)" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="btn btn-secondary btn-sm" style={{ cursor: busy ? "wait" : "pointer" }}>
              <Upload className="i i-sm" aria-hidden />
              MP3/M4A 업로드
              <input
                type="file"
                accept=".mp3,.m4a,audio/mpeg,audio/mp4"
                hidden
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {list.map((item) => (
              <li
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 14px",
                  border: "1px solid var(--border, #e5e7eb)",
                  borderRadius: 8,
                }}
              >
                <div>
                  <strong style={{ display: "block" }}>{item.name}</strong>
                  <small style={{ color: "var(--muted, #6b7280)" }}>
                    {clock(item.durationSec)} · {item.mimeType}
                  </small>
                </div>
                <audio controls preload="none" src={item.url} style={{ height: 32, maxWidth: 280 }} />
              </li>
            ))}
            {!list.length ? <li style={{ color: "var(--muted, #6b7280)" }}>등록된 배경음악이 없어요.</li> : null}
          </ul>
        </section>
      ) : (
        <section style={{ display: "grid", gap: 20 }}>
          <div className="field" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input className="input" style={{ maxWidth: 240 }} placeholder="음성 이름" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="btn btn-secondary btn-sm" style={{ cursor: busy ? "wait" : "pointer" }}>
              <Upload className="i i-sm" aria-hidden />
              음성 업로드
              <input
                type="file"
                accept=".mp3,.m4a,audio/mpeg,audio/mp4"
                hidden
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <div>
            <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>음성 클립</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {voices.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "10px 12px",
                    border: "1px solid var(--border, #e5e7eb)",
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <small style={{ display: "block", color: "var(--muted, #6b7280)" }}>{clock(item.durationSec)}</small>
                  </div>
                  <audio controls preload="none" src={item.url} style={{ height: 32, maxWidth: 240 }} />
                </li>
              ))}
            </ul>
          </div>

          <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, padding: 14 }}>
            <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>음성 팩 구성</h2>
            <input className="input" style={{ marginBottom: 10, maxWidth: 280 }} value={packName} onChange={(e) => setPackName(e.target.value)} />
            <div style={{ display: "grid", gap: 8 }}>
              {CUE_LABELS.map(({ key, label }) => (
                <label key={key} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8, alignItems: "center" }}>
                  <span className="label">{label}</span>
                  <select className="input" value={cues[key] || ""} onChange={(e) => setCues((c) => ({ ...c, [key]: e.target.value }))}>
                    <option value="">선택</option>
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={busy} onClick={() => void savePack()}>
              음성 팩 저장
            </button>
          </div>

          <div>
            <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>등록된 음성 팩</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {packs.map((pack) => (
                <li key={pack.id} style={{ padding: "10px 12px", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8 }}>
                  <strong>{pack.name}</strong>
                  {pack.isDefault ? <small style={{ marginLeft: 8 }}>기본</small> : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
