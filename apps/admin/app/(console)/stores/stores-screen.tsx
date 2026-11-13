"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Ellipsis, Plus } from "lucide-react";
import { ApiError, api } from "@/lib/api";

type Store = {
  id: string;
  name: string;
  code: string;
  tvCount: number;
  online: number;
  offline: number;
  programName: string | null;
  skin: { name: string; tone: string } | null;
  state: "ok" | "err" | "info" | "neutral";
};

const LABEL = { ok: "정상", err: "확인 필요", info: "일부 오프라인", neutral: "대기" };

export function StoresScreen() {
  const [items, setItems] = useState<Store[]>([]);
  const [summary, setSummary] = useState({ storeCount: 0, tvCount: 0 });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await api<{ summary: { storeCount: number; tvCount: number }; items: Store[] }>("/admin/v1/stores");
    setSummary(data.summary);
    setItems(data.items);
  }

  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof ApiError ? caught.message : "지점을 불러오지 못했어요"));
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
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="icon-btn" aria-label={`${store.name} 더보기`}>
                    <Ellipsis className="i" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-foot">
          <span>{summary.storeCount}곳</span>
        </div>
      </div>
    </div>
  );
}
