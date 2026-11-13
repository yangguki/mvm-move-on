"use client";

import { useCallback, useEffect, useState } from "react";

type Health = {
  ok: boolean;
  services: { postgres: "up" | "down"; redis: "up" | "down"; storage: "up" | "down" };
};

const LABELS = [
  ["postgres", "PostgreSQL"],
  ["redis", "Redis"],
  ["storage", "영상 저장소"],
] as const;

export function ServerStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const body = (await response.json()) as Health;
      setHealth(body);
      setError(null);
    } catch {
      setHealth(null);
      setError("API 서버에 연결되지 않았습니다. 포트 3001을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <p className="screen-id">ADM-SCR-02</p>
      <h1>대시보드</h1>
      <p className="lede">이 PC의 PostgreSQL, Redis, 영상 저장소가 API를 통해 응답하는지 확인합니다.</p>
      <div className="status-grid">
        {LABELS.map(([key, label]) => {
          const state = health?.services[key];
          const tone = state === "up" ? "up" : "down";
          const text = loading ? "확인 중" : state === "up" ? "연결됨" : "응답 없음";
          return (
            <article key={key} className={`status-card ${health ? tone : ""}`}>
              <span>{label}</span>
              <b>{error ? "확인 불가" : text}</b>
            </article>
          );
        })}
      </div>
      {error ? <p className="lede" style={{ marginTop: 16 }}>{error}</p> : null}
      <div className="actions">
        <button type="button" onClick={() => void load()}>다시 확인</button>
      </div>
    </section>
  );
}
