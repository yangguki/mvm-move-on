"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Download, Ellipsis, Link2, ListVideo, Monitor, MonitorOff, Palette, Power, RotateCw, Search, X } from "lucide-react";
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

type Summary = { total: number; playing: number; idle: number; updating: number; offline: number };
type Store = { id: string; name: string; code: string };

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
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [gap, setGap] = useState("");

  async function load(nextStatus = status, nextQuery = query) {
    const params = new URLSearchParams();
    if (nextStatus) params.set("status", nextStatus);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const data = await api<{ summary: Summary; items: Device[] }>(`/admin/v1/devices${params.size ? `?${params}` : ""}`);
    setSummary(data.summary);
    setItems(data.items);
  }

  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof ApiError ? caught.message : "TV 목록을 불러오지 못했어요"));
    void api<{ items: Store[] }>("/admin/v1/stores").then((data) => {
      setStores(data.items);
      setStoreId(data.items[0]?.id ?? "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pair() {
    setError("");
    try {
      const result = await api<{ code: string; store: { name: string } }>("/admin/v1/pairing-sessions", {
        method: "POST",
        body: JSON.stringify({ storeId }),
      });
      setCode(`${result.store.name} 연결 코드 ${result.code} · 10분 동안 유효해요`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "연결 코드를 만들지 못했어요");
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
          <button type="button" className="btn btn-primary" onClick={() => void pair()}>
            <Link2 className="i" aria-hidden />
            TV 연결하기
          </button>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {gap ? <p className="form-error">{gap}</p> : null}
      {code ? <p className="card pair-box">{code}</p> : null}
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
        <label className="select">
          <span>
            <span className="k">지점</span>
          </span>
          <select value={storeId} onChange={(event) => setStoreId(event.target.value)} aria-label="연결할 지점" style={{ border: 0, background: "transparent", font: "inherit" }}>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          <ChevronDown className="i i-sm" aria-hidden />
        </label>
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
                <td style={{ textAlign: "right" }}>
                  {row.guide ? (
                    <button type="button" className="btn btn-secondary btn-sm" style={{ height: 28 }} onClick={() => void pair()}>
                      연결 안내
                    </button>
                  ) : (
                    <button type="button" className="icon-btn" aria-label={`${row.code} 더보기`} onClick={() => setGap("기기별 메뉴 API가 아직 없어요")}>
                      <Ellipsis className="i" aria-hidden />
                    </button>
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
    </div>
  );
}
