"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { ArrowLeft, Plus, AlertCircle, Trash2 } from "lucide-react";
import { BuilderScreen } from "./builder-screen";

type ProgramItem = {
  id: string;
  name: string;
  status: "draft" | "published";
  draftUpdatedAt: string;
  publishedVersion: number | null;
  needsRepublish?: boolean;
  skin?: { id: string; name: string };
};

function ProgramList({
  onSelect,
  onNew,
  creating,
}: {
  onSelect: (id: string) => void;
  onNew: () => void;
  creating?: boolean;
}) {
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ items: ProgramItem[] }>("/admin/v1/programs");
      setPrograms(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "프로그램을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleDelete(program: ProgramItem, event: MouseEvent) {
    event.stopPropagation();
    if (!window.confirm(`"${program.name}" 프로그램을 삭제할까요?`)) return;
    setError("");
    setDeletingId(program.id);
    try {
      await api(`/admin/v1/programs/${program.id}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "프로그램을 삭제하지 못했어요");
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="t-title">프로그램</h1>
          <p>운동 루틴을 만들고 TV에 게시해요</p>
        </div>
        <button type="button" className="btn btn-primary" disabled={creating} onClick={onNew}>
          <Plus className="i" aria-hidden />
          새 프로그램
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p className="subtle">불러오는 중...</p>
      ) : programs.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <p className="subtle">아직 프로그램이 없어요</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} disabled={creating} onClick={onNew}>
            <Plus className="i" aria-hidden />
            첫 프로그램 만들기
          </button>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>이름</th>
                <th>상태</th>
                <th>스킨</th>
                <th>수정일</th>
                <th style={{ width: 72 }} />
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id} onClick={() => onSelect(p.id)} style={{ cursor: "pointer" }}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.needsRepublish && (
                      <span className="badge badge-warning" style={{ marginLeft: 8 }}>
                        <AlertCircle className="i" style={{ width: 12, height: 12 }} />
                        재게시 필요
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${p.status === "published" ? "badge-success" : "badge-outline"}`}>
                      {p.status === "published" ? `게시됨 v${p.publishedVersion}` : "초안"}
                    </span>
                  </td>
                  <td>{p.skin?.name ?? "-"}</td>
                  <td className="subtle">{formatDate(p.draftUpdatedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={deletingId === p.id}
                      aria-label={`${p.name} 삭제`}
                      onClick={(event) => void handleDelete(p, event)}
                    >
                      <Trash2 className="i" aria-hidden />
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function ProgramsPage() {
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [editId, setEditId] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  function handleSelect(id: string) {
    setEditId(id);
    setMode("edit");
  }

  async function handleNew() {
    setCreating(true);
    setCreateError("");
    try {
      const created = await api<{ id: string }>("/admin/v1/programs", {
        method: "POST",
        body: JSON.stringify({
          name: "새 프로그램",
          draft: {
            items: [{ id: "guide-1", type: "guide", durationSec: 10, label: "시작 카운트다운" }],
            // tokens skin: empty draft works without screenId (html skins require it)
            skin: { id: "wod-chalkboard", options: { pointColor: "#C8F31D", nextLeadSec: 10 } },
          },
        }),
      });
      setEditId(created.id);
      setMode("edit");
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : "프로그램을 만들지 못했어요");
    } finally {
      setCreating(false);
    }
  }

  function handleBack() {
    setMode("list");
    setEditId(undefined);
  }

  if (mode === "edit") {
    return (
      <>
        <button type="button" className="btn btn-ghost" onClick={handleBack} style={{ marginBottom: 16 }}>
          <ArrowLeft className="i" aria-hidden />
          목록으로
        </button>
        <BuilderScreen initialId={editId} onDeleted={handleBack} />
      </>
    );
  }

  return (
    <>
      {createError ? <p className="form-error">{createError}</p> : null}
      <ProgramList onSelect={handleSelect} onNew={() => void handleNew()} creating={creating} />
    </>
  );
}
