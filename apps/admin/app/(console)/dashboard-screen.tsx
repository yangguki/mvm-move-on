"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, ChevronRight, Link2, Monitor, MonitorOff, Plus, WifiOff } from "lucide-react";
import { ApiError, api } from "@/lib/api";

type Dashboard = {
  dateLabel: string;
  programName: string | null;
  playing: { count: number; total: number };
  online: { count: number; total: number };
  stores: { count: number; attention: number };
  offline: Array<{ code: string; name: string; store: string; seenLabel: string }>;
};

type Device = {
  id: string;
  name: string;
  code: string;
  store: { name: string };
  status: "ok" | "err" | "neutral" | "info";
  statusLabel: string;
  playing: string | null;
  progress: number | null;
  offline: boolean;
  seenLabel: string;
};

const WEEK = [
  ["월", "스트렝스"],
  ["화", "섹시백"],
  ["수", "코어"],
  ["목", "버닝부스트"],
  ["금", "머슬핏"],
  ["토", "하이브리드"],
] as const;

export function DashboardScreen() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [programs, setPrograms] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      api<Dashboard>("/admin/v1/dashboard"),
      api<{ items: Device[] }>("/admin/v1/devices"),
      api<{ items: unknown[] }>("/admin/v1/programs"),
    ])
      .then(([dashboard, deviceList, programList]) => {
        setData(dashboard);
        setDevices([...deviceList.items].sort((a, b) => Number(b.offline) - Number(a.offline)).slice(0, 5));
        setPrograms(programList.items.length);
      })
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "현황을 불러오지 못했어요"));
  }, []);

  async function createProgram() {
    const created = await api<{ id: string }>("/admin/v1/programs", {
      method: "POST",
      body: JSON.stringify({
        name: "새 프로그램",
        draft: {
          items: [{ id: "guide-1", type: "guide", durationSec: 10, label: "시작 카운트다운" }],
          skin: { id: "neon-arcade", options: { pointColor: "#C8F31D", nextLeadSec: 10 } },
        },
      }),
    });
    router.push(`/programs?id=${created.id}`);
  }

  if (error) return <p className="form-error">{error}</p>;
  if (!data) return <p className="subtle">운영 현황을 불러오는 중이에요</p>;

  const lead = devices.find((device) => device.status === "ok" && device.progress);
  const onlineWidth = data.online.total ? Math.round((data.online.count / data.online.total) * 100) : 0;
  const program = data.programName ?? "편성 없음";

  return (
    <>
      <div className="dash">
        <div className="page-head">
          <div>
            <h1 className="t-title">오늘의 운영 현황</h1>
            <p>
              {data.dateLabel} · 오늘 편성 <b style={{ color: "var(--text)", fontWeight: 600 }}>{program}</b>
            </p>
          </div>
          <div className="row">
            <Link href="/devices" className="btn btn-secondary">
              <Link2 className="i" aria-hidden />
              TV 연결
            </Link>
            <button type="button" className="btn btn-primary" onClick={() => void createProgram()}>
              <Plus className="i" aria-hidden />새 프로그램
            </button>
          </div>
        </div>
        <section className="kpis">
          <article className="card kpi kpi-now">
            <div className="kpi-top">
              <span>지금 재생 중</span>
              <span className="live">
                <span className="dot" />
                {data.playing.count}대
              </span>
            </div>
            <div className="kpi-val">
              <span className="display">{data.playing.count}</span>
              <span className="unit">대 · {program}</span>
            </div>
            <div className="kpi-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div className="block-bar">
                <i style={{ width: `${lead?.progress ?? 0}%` }} />
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="num">{lead ? `${lead.progress}%` : "대기"}</span>
                <span>{data.playing.total}대 중</span>
              </div>
            </div>
          </article>
          <article className="card kpi">
            <div className="kpi-top">
              <span>온라인 TV</span>
              <Monitor className="i" aria-hidden />
            </div>
            <div className="kpi-val">
              <span className="display">{data.online.count}</span>
              <span className="unit">/ {data.online.total}대</span>
            </div>
            <div className="kpi-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div className="meter">
                <i style={{ width: `${onlineWidth}%`, background: "var(--ok-500)" }} />
                <i style={{ width: `${100 - onlineWidth}%`, background: "var(--err-500)" }} />
              </div>
              <span>
                오프라인 <b style={{ color: "var(--err-700)", fontWeight: 650 }}>{data.online.total - data.online.count}대</b> · {data.stores.attention}개 지점
              </span>
            </div>
          </article>
          <article className="card kpi">
            <div className="kpi-top">
              <span>등록된 지점</span>
            </div>
            <div className="kpi-val">
              <span className="display">{data.stores.count}</span>
              <span className="unit">곳</span>
            </div>
            <div className="kpi-foot">확인이 필요한 지점 {data.stores.attention}곳</div>
          </article>
          <article className="card kpi">
            <div className="kpi-top">
              <span>프로그램</span>
            </div>
            <div className="kpi-val">
              <span className="display">{programs}</span>
              <span className="unit">개</span>
            </div>
            <div className="kpi-foot">저장된 초안과 발행본이에요</div>
          </article>
        </section>
        <section className="grid2">
          <article className="card tv-list">
            <div className="card-head">
              <h2 className="t-h2">TV 상태</h2>
              <Link href="/devices" className="btn btn-ghost btn-sm">
                전체 보기
                <ArrowRight className="i i-sm" aria-hidden />
              </Link>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>TV</th>
                  <th>지금 재생</th>
                  <th>상태</th>
                  <th style={{ textAlign: "right" }}>마지막 응답</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <div className="tv-name">
                        <span className={device.offline ? "tv-ico off" : "tv-ico"}>
                          {device.offline ? <MonitorOff className="i" aria-hidden /> : <Monitor className="i" aria-hidden />}
                        </span>
                        <div>
                          <div className="cell-main">{device.name}</div>
                          <div className="cell-sub">{device.store.name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {device.progress ? (
                        <div className="playing">
                          <span>{device.playing}</span>
                          <span className="mini-prog">
                            <i style={{ width: `${device.progress}%` }} />
                          </span>
                        </div>
                      ) : (
                        <span className={device.playing ? "muted" : "subtle"}>{device.playing ?? "—"}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${device.status}`}>
                        <span className="dot" />
                        {device.statusLabel}
                      </span>
                    </td>
                    <td className="num subtle" style={{ textAlign: "right" }}>
                      {device.seenLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
          <div style={{ display: "grid", gap: 16 }}>
            <article className="card">
              <div className="card-head" style={{ paddingBottom: 12, minHeight: 0 }}>
                <h2 className="t-h2">이번 주 편성</h2>
                <Link href="/programs" className="btn btn-ghost btn-sm">
                  편성 관리
                </Link>
              </div>
              <div className="card-body" style={{ paddingBottom: 16 }}>
                <div className="week">
                  {WEEK.map(([day, name]) => (
                    <div key={day} className={day === "금" ? "day today" : "day"}>
                      <b>{day}</b>
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
                <p className="hint" style={{ marginTop: 10 }}>
                  요일 편성 API가 아직 없어요. 금요일이 오늘 편성으로 보여요.
                </p>
              </div>
            </article>
            <article className="card">
              <div className="card-head" style={{ paddingBottom: 12, minHeight: 0 }}>
                <h2 className="t-h2">확인이 필요해요</h2>
                <span className="badge badge-err">{data.offline.length}</span>
              </div>
              {data.offline.length === 0 ? <div className="alert-row">끊긴 TV가 없어요</div> : null}
              {data.offline.map((device) => (
                <div key={device.code} className="alert-row">
                  <span className="alert-ico" style={{ background: "var(--err-50)", color: "var(--err-700)" }}>
                    <WifiOff className="i" aria-hidden />
                  </span>
                  <div className="grow">
                    <b>
                      {device.store} · {device.name}
                    </b>
                    <small>{device.seenLabel} 마지막 응답</small>
                  </div>
                  <ChevronRight className="i subtle" aria-hidden />
                </div>
              ))}
            </article>
          </div>
        </section>
      </div>

      <div className="dash-mob">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="chip-store">
            <span className="mk">HQ</span>
            MVM 본사 · {data.stores.count}곳
            <ChevronDown className="i i-sm subtle" aria-hidden />
          </span>
        </div>
        <div>
          <h1 className="mob-title">오늘의 운영 현황</h1>
          <p className="t-sm muted" style={{ marginTop: 2 }}>
            {data.dateLabel} · 오늘 편성 <b style={{ color: "var(--text)" }}>{program}</b>
          </p>
        </div>
        <article className="now">
          <div className="top">
            <span>지금 재생 중</span>
            <span className="live">
              <span className="dot" />
              {data.playing.count}대
            </span>
          </div>
          <div className="val">
            <span className="display">{data.playing.count}</span>
            <span>대 · {program}</span>
          </div>
          <div className="bbar">
            <i style={{ width: `${lead?.progress ?? 0}%` }} />
          </div>
          <div className="foot">
            <span>{lead ? `${lead.progress}%` : "대기"}</span>
            <span>{data.online.count}/{data.online.total} 온라인</span>
          </div>
        </article>
        <div className="kp">
          <div className="card">
            <div className="l">온라인 TV</div>
            <div className="v">
              <span className="display">{data.online.count}</span>
              <span>/ {data.online.total}</span>
            </div>
            <div className="s">
              오프라인 <b style={{ color: "var(--err-700)" }}>{data.online.total - data.online.count}대</b>
            </div>
          </div>
          <div className="card">
            <div className="l">프로그램</div>
            <div className="v">
              <span className="display">{programs}</span>
              <span>개</span>
            </div>
            <div className="s">지점 {data.stores.count}곳</div>
          </div>
        </div>
        <div className="sec">
          <h2>
            확인이 필요해요 <span style={{ color: "var(--err-700)" }}>{data.offline.length}</span>
          </h2>
          <Link href="/devices" className="t-sm muted" style={{ fontWeight: 600 }}>
            모두 보기
          </Link>
        </div>
        <div className="card">
          {data.offline.slice(0, 2).map((device) => (
            <div key={device.code} className="li">
              <span className="ic" style={{ background: "var(--err-50)", color: "var(--err-700)" }}>
                <WifiOff className="i" aria-hidden />
              </span>
              <div className="grow">
                <b>
                  {device.store} · {device.name}
                </b>
                <small>{device.seenLabel}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
