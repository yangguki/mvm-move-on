"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Ellipsis, Plus, X } from "lucide-react";
import { ApiError, api } from "@/lib/api";

type Store = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  tvCount: number;
  online: number;
  offline: number;
  programName: string | null;
  program: { id: string; name: string } | null;
  skin: { name: string; tone: string } | null;
  state: "ok" | "err" | "info" | "neutral";
};

type Program = { id: string; name: string };

const LABEL = { ok: "정상", err: "확인 필요", info: "일부 오프라인", neutral: "대기" };

export function StoresScreen() {
  const [items, setItems] = useState<Store[]>([]);
  const [summary, setSummary] = useState({ storeCount: 0, tvCount: 0 });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [editName, setEditName] = useState("");
  const [editProgramId, setEditProgramId] = useState<string | null>(null);
  const [editIsActive, setEditIsActive] = useState(true);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingStatus, setPairingStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pairingMsg, setPairingMsg] = useState("");

  async function load() {
    const data = await api<{ summary: { storeCount: number; tvCount: number }; items: Store[] }>("/admin/v1/stores");
    setSummary(data.summary);
    setItems(data.items);
  }

  async function loadPrograms() {
    const data = await api<{ items: Program[] }>("/admin/v1/programs");
    setPrograms(data.items.filter((p) => p.name));
  }

  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof ApiError ? caught.message : "지점을 불러오지 못했어요"));
    void loadPrograms().catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/admin/v1/stores", { method: "POST", body: JSON.stringify({ name, code }) });
      setName("");
      setCode("");
      setOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "지점을 추가하지 못했어요");
    }
  }

  function openEdit(store: Store) {
    setEditStore(store);
    setEditName(store.name);
    setEditProgramId(store.program?.id ?? null);
    setEditIsActive(store.isActive);
    setMenuOpen(null);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editStore) return;
    setError("");
    try {
      await api(`/admin/v1/stores/${editStore.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          programId: editProgramId,
          isActive: editIsActive,
        }),
      });
      setEditStore(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "지점을 수정하지 못했어요");
    }
  }

  async function handleDelete(store: Store) {
    if (!window.confirm(`"${store.name}" 지점을 삭제하시겠습니까?`)) return;
    setMenuOpen(null);
    setError("");
    try {
      await api(`/admin/v1/stores/${store.id}`, { method: "DELETE" });
      await load();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError("지점을 삭제하지 못했어요");
      }
    }
  }

  async function toggleActive(store: Store) {
    setMenuOpen(null);
    setError("");
    try {
      await api(`/admin/v1/stores/${store.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !store.isActive }),
      });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "지점 상태를 변경하지 못했어요");
    }
  }

  async function approvePairing(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(pairingCode)) {
      setPairingStatus("error");
      setPairingMsg("6자리 숫자 코드가 필요해요");
      return;
    }
    setPairingStatus("loading");
    setPairingMsg("");
    try {
      const res = await api<{ ok: boolean; device: { code: string; name: string } }>("/admin/v1/approve-pairing", {
        method: "POST",
        body: JSON.stringify({ code: pairingCode }),
      });
      setPairingStatus("success");
      setPairingMsg(`TV 승인 완료: ${res.device.code}`);
      setPairingCode("");
      await load();
      setTimeout(() => { setPairingStatus("idle"); setPairingMsg(""); }, 3000);
    } catch (caught) {
      setPairingStatus("error");
      setPairingMsg(caught instanceof ApiError ? caught.message : "승인 실패");
    }
  }

  const attention = items.filter((store) => store.offline > 0).length;

  return (
    <div className="ops">
      <div className="page-head">
        <div>
          <h1 className="t-title">지점</h1>
          <p>
            등록된 지점 {summary.storeCount}곳 · 연결된 TV {summary.tvCount}대예요
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen((value) => !value)}>
          <Plus className="i" aria-hidden />
          지점 추가
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <form className="card pair-box" onSubmit={(event) => void approvePairing(event)} style={{ marginBottom: 16 }}>
        <span style={{ fontWeight: 600, marginRight: 8 }}>TV 승인</span>
        <input
          className="input"
          style={{ width: 120 }}
          placeholder="6자리 코드"
          value={pairingCode}
          onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          maxLength={6}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={pairingStatus === "loading"}>
          {pairingStatus === "loading" ? "승인 중..." : "승인"}
        </button>
        {pairingMsg && (
          <span style={{ marginLeft: 12, color: pairingStatus === "success" ? "var(--volt-700)" : "var(--err-700)" }}>
            {pairingMsg}
          </span>
        )}
      </form>
      {open ? (
        <form className="card pair-box" onSubmit={(event) => void create(event)}>
          <input className="input" style={{ width: 220 }} placeholder="지점 이름" value={name} onChange={(event) => setName(event.target.value)} required />
          <input className="input" style={{ width: 120 }} placeholder="코드" value={code} onChange={(event) => setCode(event.target.value)} required />
          <button type="submit" className="btn btn-primary btn-sm">
            추가
          </button>
        </form>
      ) : null}
      <div className="filters">
        <div className="seg">
          <span className="on">
            전체 <span className="count">{summary.storeCount}</span>
          </span>
          <span>
            확인 필요 <span className="count" style={{ color: "var(--err-700)" }}>{attention}</span>
          </span>
        </div>
      </div>
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>지점</th>
              <th>TV</th>
              <th>온라인</th>
              <th>오프라인</th>
              <th>오늘 편성</th>
              <th>스킨</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((store) => (
              <tr key={store.id}>
                <td>
                  <div className="cell-main">{store.name}</div>
                  <div className="cell-sub mono">{store.code}</div>
                </td>
                <td className="num">{store.tvCount}대</td>
                <td className="num">{store.online}</td>
                <td className="num" style={{ color: store.offline ? "var(--err-700)" : undefined, fontWeight: store.offline ? 650 : undefined }}>
                  {store.offline}
                </td>
                <td className={store.programName ? undefined : "subtle"}>{store.programName ?? "—"}</td>
                <td>
                  {store.skin ? (
                    <span className="row" style={{ gap: 8 }}>
                      <span className="swatch" style={{ background: store.skin.tone }} />
                      {store.skin.name}
                    </span>
                  ) : (
                    <span className="subtle">—</span>
                  )}
                </td>
                <td>
                  <span className={`badge badge-${store.state}`}>
                    <span className="dot" />
                    {LABEL[store.state]}
                  </span>
                </td>
                <td style={{ textAlign: "right", position: "relative" }}>
                  <button type="button" className="icon-btn" aria-label={`${store.name} 더보기`} onClick={() => setMenuOpen(menuOpen === store.id ? null : store.id)}>
                    <Ellipsis className="i" aria-hidden />
                  </button>
                  {menuOpen === store.id && (
                    <div ref={menuRef} className="dropdown-menu" style={{ position: "absolute", right: 0, top: "100%", zIndex: 50 }}>
                      <button type="button" onClick={() => openEdit(store)}>수정</button>
                      <button type="button" onClick={() => void toggleActive(store)}>{store.isActive ? "비활성화" : "활성화"}</button>
                      <button type="button" onClick={() => void handleDelete(store)} style={{ color: "var(--err-700)" }}>삭제</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-foot">
          <span>{summary.storeCount}곳</span>
        </div>
      </div>
      {editStore && (
        <div className="modal-backdrop" onClick={() => setEditStore(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>지점 수정</h2>
              <button type="button" className="icon-btn" onClick={() => setEditStore(null)} aria-label="닫기">
                <X className="i" aria-hidden />
              </button>
            </div>
            <form onSubmit={(event) => void saveEdit(event)}>
              <div className="modal-body">
                <div className="field">
                  <label>지점 이름</label>
                  <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <div className="field">
                  <label>코드 (읽기 전용)</label>
                  <input className="input" value={editStore.code} disabled />
                </div>
                <div className="field">
                  <label>프로그램</label>
                  <select className="input" value={editProgramId ?? ""} onChange={(e) => setEditProgramId(e.target.value || null)}>
                    <option value="">선택 안 함</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" id="isActive" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} />
                  <label htmlFor="isActive">활성 상태</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setEditStore(null)}>취소</button>
                <button type="submit" className="btn btn-primary">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
