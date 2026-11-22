"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Download, Ellipsis, ListVideo, Monitor, MonitorOff, Palette, Power, RotateCw, Search, X } from "lucide-react";
import { ApiError, api } from "@/lib/api";

type Device = {
  id: string;
  name: string;
  code: string;
  store: { id: string; name: string; code: string };
  status: "ok" | "err" | "neutral" | "info";
  statusLabel: string;
  playing: string | null;
  progress: number | null;
  skin: { name: string; tone: string };
  appVersion: string;
  versionWarn: boolean;
  seenLabel: string;
  seenAlert: boolean;
  guide: boolean;
  offline: boolean;
};

type Store = { id: string; name: string; code: string; isActive: boolean };

type Summary = { total: number; playing: number; idle: number; updating: number; offline: number };

const FILTERS = [
  ["", "전체", "total"],
  ["ok", "재생 중", "playing"],
  ["neutral", "대기", "idle"],
  ["info", "업데이트", "updating"],
  ["err", "오프라인", "offline"],
] as const;

export function DevicesScreen() {
  const [items, setItems] = useState<Device[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, playing: 0, idle: 0, updating: 0, offline: 0 });
  const [stores, setStores] = useState<Store[]>([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [gap, setGap] = useState("");
  const [flash, setFlash] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [renameDevice, setRenameDevice] = useState<Device | null>(null);
  const [renameName, setRenameName] = useState("");
  const [moveDevice, setMoveDevice] = useState<Device | null>(null);
  const [moveStoreId, setMoveStoreId] = useState("");
  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);

  async function load(nextStatus = status, nextQuery = query) {
    const params = new URLSearchParams();
    if (nextStatus) params.set("status", nextStatus);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const data = await api<{ summary: Summary; items: Device[] }>(`/admin/v1/devices${params.size ? `?${params}` : ""}`);
    setSummary(data.summary);
    setItems(data.items);
  }

  async function loadStores() {
    const data = await api<{ items: Store[] }>("/admin/v1/stores");
    setStores(data.items.filter((s) => s.isActive));
  }

  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof ApiError ? caught.message : "TV 목록을 불러오지 못했어요"));
    void loadStores().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function showFlash(msg: string, isError = false) {
    if (isError) setError(msg);
    else {
      setError("");
      setFlash(msg);
      setTimeout(() => setFlash(""), 3000);
    }
  }

  function openRename(device: Device) {
    setRenameDevice(device);
    setRenameName(device.name);
    setMenuOpen(null);
  }

  function openMove(device: Device) {
    setMoveDevice(device);
    setMoveStoreId(device.store.id);
    setMenuOpen(null);
  }

  function openDelete(device: Device) {
    setDeleteDevice(device);
    setMenuOpen(null);
  }

  async function saveRename(event: FormEvent) {
    event.preventDefault();
    if (!renameDevice) return;
    const trimmed = renameName.trim();
    if (!trimmed) {
      showFlash("TV 이름을 입력해 주세요", true);
      return;
    }
    try {
      await api(`/admin/v1/devices/${renameDevice.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      setRenameDevice(null);
      await load();
      showFlash("이름을 변경했어요");
    } catch (caught) {
      showFlash(caught instanceof ApiError ? caught.message : "이름을 변경하지 못했어요", true);
    }
  }

  async function saveMove(event: FormEvent) {
    event.preventDefault();
    if (!moveDevice || !moveStoreId) return;
    try {
      await api(`/admin/v1/devices/${moveDevice.id}`, {
        method: "PATCH",
        body: JSON.stringify({ storeId: moveStoreId }),
      });
      setMoveDevice(null);
      await load();
      showFlash("지점을 이동했어요");
    } catch (caught) {
      showFlash(caught instanceof ApiError ? caught.message : "지점을 이동하지 못했어요", true);
    }
  }

  async function confirmDelete() {
    if (!deleteDevice) return;
    try {
      await api(`/admin/v1/devices/${deleteDevice.id}`, { method: "DELETE" });
      setDeleteDevice(null);
      await load();
      showFlash("TV를 삭제했어요");
    } catch (caught) {
      showFlash(caught instanceof ApiError ? caught.message : "TV를 삭제하지 못했어요", true);
      setDeleteDevice(null);
    }
  }

  return (
    <div className="ops">
      <div className="page-head">
        <div>
          <h1 className="t-title">TV · 기기</h1>
          <p>연결된 TV {summary.total}대예요</p>
        </div>
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={() => setGap("내보내기 API가 아직 없어요")}>
            <Download className="i" aria-hidden />
            내보내기
          </button>
          <Link href="/stores/" className="btn btn-primary">
            지점에서 TV 승인
          </Link>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {flash ? <p className="card pair-box" style={{ marginBottom: 16, color: "var(--ok-700)" }}>{flash}</p> : null}
      {gap ? <p className="form-error">{gap}</p> : null}
      <div className="filters">
        <div className="seg">
          {FILTERS.map(([value, label, key]) => (
            <button
              key={label}
              type="button"
              className={status === value ? "on" : undefined}
              onClick={() => {
                setStatus(value);
                void load(value, query).catch((caught) => setError(caught instanceof ApiError ? caught.message : "다시 불러오지 못했어요"));
              }}
            >
              {label} <span className="count" style={value === "err" ? { color: "var(--err-700)" } : undefined}>{summary[key]}</span>
            </button>
          ))}
        </div>
        <form
          className="input-icon"
          style={{ width: 240, marginLeft: 8 }}
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <Search className="i i-sm" aria-hidden />
          <input className="input" style={{ height: 32, fontSize: 13 }} placeholder="TV 이름 또는 코드" value={query} onChange={(event) => setQuery(event.target.value)} />
        </form>
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => void load()}>
          <RotateCw className="i" aria-hidden />
          새로고침
        </button>
      </div>
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 44 }} />
              <th>TV</th>
              <th>지점</th>
              <th>상태</th>
              <th>지금 재생</th>
              <th>스킨</th>
              <th>앱 버전</th>
              <th>마지막 응답</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className={selected === row.id ? "is-selected" : undefined}>
                <td>
                  <button type="button" className={selected === row.id ? "check on" : "check"} aria-label={`${row.code} 선택`} onClick={() => setSelected(selected === row.id ? null : row.id)}>
                    {selected === row.id ? <Check className="i" style={{ width: 12, height: 12 }} strokeWidth={3} aria-hidden /> : null}
                  </button>
                </td>
                <td>
                  <div className="tv-name">
                    <span className={row.offline ? "tv-ico off" : "tv-ico"}>{row.offline ? <MonitorOff className="i" aria-hidden /> : <Monitor className="i" aria-hidden />}</span>
                    <div>
                      <div className="cell-main">{row.name}</div>
                      <div className="cell-sub mono">{row.code}</div>
                    </div>
                  </div>
                </td>
                <td>{row.store.name}</td>
                <td>
                  <span className={`badge badge-${row.status}`}>
                    <span className="dot" />
                    {row.statusLabel}
                  </span>
                </td>
                <td>
                  {row.progress ? (
                    <div className="playing">
                      <span>{row.playing}</span>
                      <span className="mini-prog">
                        <i style={{ width: `${row.progress}%` }} />
                      </span>
                    </div>
                  ) : (
                    <span className={row.playing ? "muted" : "subtle"}>{row.playing ?? "—"}</span>
                  )}
                </td>
                <td>
                  <span className="row" style={{ gap: 8 }}>
                    <span className="swatch" style={{ background: row.skin.tone }} />
                    {row.skin.name}
                  </span>
                </td>
                <td>
                  <span className="mono" style={{ color: row.versionWarn ? "var(--warn-700)" : undefined }}>
                    {row.appVersion}
                  </span>
                </td>
                <td className="num" style={row.seenAlert ? { color: "var(--err-700)", fontWeight: 600 } : undefined}>
                  {row.seenLabel}
                </td>
                <td style={{ textAlign: "right", position: "relative" }}>
                  <button type="button" className="icon-btn" aria-label={`${row.code} 더보기`} onClick={() => setMenuOpen(menuOpen === row.id ? null : row.id)}>
                    <Ellipsis className="i" aria-hidden />
                  </button>
                  {menuOpen === row.id && (
                    <div ref={menuRef} className="dropdown-menu" style={{ position: "absolute", right: 0, top: "100%", zIndex: 50 }}>
                      <button type="button" onClick={() => openRename(row)}>이름 변경</button>
                      <button type="button" onClick={() => openMove(row)}>지점 이동</button>
                      <button type="button" onClick={() => openDelete(row)} style={{ color: "var(--err-700)" }}>삭제</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-foot">
          <span>{summary.total}대 중 {items.length}대</span>
        </div>
      </div>
      {selected ? (
        <div className="bulk">
          <b>
            <em>1대</em> 선택됨
          </b>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGap("프로그램 지정 API가 아직 없어요")}>
            <ListVideo className="i" aria-hidden />
            프로그램 지정
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGap("스킨 변경 API가 아직 없어요")}>
            <Palette className="i" aria-hidden />
            스킨 변경
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGap("원격 재시작 API가 아직 없어요")}>
            <Power className="i" aria-hidden />
            원격 재시작
          </button>
          <span className="vsep" />
          <button type="button" className="icon-btn" style={{ color: "#9AA39D" }} aria-label="선택 해제" onClick={() => setSelected(null)}>
            <X className="i" aria-hidden />
          </button>
        </div>
      ) : null}
      {renameDevice && (
        <div className="modal-backdrop" onClick={() => setRenameDevice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>TV 이름 변경</h2>
              <button type="button" className="icon-btn" onClick={() => setRenameDevice(null)} aria-label="닫기">
                <X className="i" aria-hidden />
              </button>
            </div>
            <form onSubmit={(event) => void saveRename(event)}>
              <div className="modal-body">
                <div className="field">
                  <label>TV 이름</label>
                  <input className="input" value={renameName} onChange={(e) => setRenameName(e.target.value)} required autoFocus />
                </div>
                <p className="cell-sub mono">{renameDevice.code}</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setRenameDevice(null)}>취소</button>
                <button type="submit" className="btn btn-primary">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {moveDevice && (
        <div className="modal-backdrop" onClick={() => setMoveDevice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>지점 이동</h2>
              <button type="button" className="icon-btn" onClick={() => setMoveDevice(null)} aria-label="닫기">
                <X className="i" aria-hidden />
              </button>
            </div>
            <form onSubmit={(event) => void saveMove(event)}>
              <div className="modal-body">
                <p style={{ marginBottom: 12 }}>
                  <strong>{moveDevice.name}</strong>
                  <span className="cell-sub mono" style={{ marginLeft: 8 }}>{moveDevice.code}</span>
                </p>
                <div className="field">
                  <label>이동할 지점</label>
                  <select className="input" value={moveStoreId} onChange={(e) => setMoveStoreId(e.target.value)} required>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setMoveDevice(null)}>취소</button>
                <button type="submit" className="btn btn-primary">이동</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleteDevice && (
        <div className="modal-backdrop" onClick={() => setDeleteDevice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>TV 삭제</h2>
              <button type="button" className="icon-btn" onClick={() => setDeleteDevice(null)} aria-label="닫기">
                <X className="i" aria-hidden />
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>{deleteDevice.name}</strong>
                <span className="cell-sub mono" style={{ marginLeft: 8 }}>{deleteDevice.code}</span>
                을(를) 삭제할까요?
              </p>
              <p className="subtle" style={{ marginTop: 12 }}>
                TV는 페어링 코드 화면으로 돌아가요. 관리자에서 다시 승인해야 연결됩니다.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setDeleteDevice(null)}>취소</button>
              <button type="button" className="btn btn-primary" style={{ background: "var(--err-700)" }} onClick={() => void confirmDelete()}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}