"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CalendarClock, Check, ChevronDown, Play, Plus } from "lucide-react";

type Frame = "exercise" | "next" | "rest";
type TemplateId = "neon" | "iron" | "live" | "power" | "wod";

const FRAMES: Record<Frame, { src: string; alt: string }> = {
  exercise: { src: "/media/skin-neon-exercise.jpg", alt: "네온 아케이드 운동 화면 미리보기" },
  next: { src: "/media/skin-neon-next.jpg", alt: "네온 아케이드 NEXT 예고 화면 미리보기" },
  rest: { src: "/media/skin-neon-rest.jpg", alt: "네온 아케이드 휴식 화면 미리보기" },
};

const TEMPLATES: Array<{ id: TemplateId; name: string; use: string; mock?: string }> = [
  { id: "neon", name: "네온 아케이드", use: "6개 지점 사용 중" },
  { id: "iron", name: "아이언 짐", use: "2개 지점", mock: "m-iron" },
  { id: "live", name: "라이브 중계", use: "2개 지점", mock: "m-live" },
  { id: "power", name: "파워 에너지", use: "2개 지점", mock: "m-power" },
  { id: "wod", name: "WOD 칠판", use: "1개 지점", mock: "m-wod" },
];

const COLORS = ["#00F0FF", "#C8F31D", "#FF4FA8", "#FFB020", "#7C5CFF"];

const WAVE = [11, 13, 7, 16, 19, 8, 6, 6, 4, 16, 13, 5, 11, 20, 15, 12, 9, 7, 12, 10, 4, 12, 12, 10, 9, 13, 13, 15, 6, 14, 16, 20, 11, 9, 11, 19, 12, 6, 13, 4, 13, 13, 20, 10];

function Mini({ kind }: { kind: string }) {
  return (
    <div className="mini">
      <div className="hud">
        {kind === "m-live" ? (
          <span className="row" style={{ gap: 3 }}>
            <span className="live">LIVE</span>SET 1
          </span>
        ) : (
          <span>{kind === "m-wod" ? "WOD" : "STEP 1/2"}</span>
        )}
        <span className="ttl">숄더 프레스</span>
        <span className="tm">{kind === "m-live" ? "0:12" : "00:12"}</span>
      </div>
      <div className="bar" />
      <div className="vid" />
    </div>
  );
}

export function SkinsView() {
  const [frame, setFrame] = useState<Frame>("rest");
  const [template, setTemplate] = useState<TemplateId>("neon");
  const [color, setColor] = useState("#C8F31D");
  const [uses, setUses] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const current = TEMPLATES.find((item) => item.id === template) ?? TEMPLATES[0];

  useEffect(() => {
    void api<{ items: Array<{ slug: string; storeCount: number }> }>("/admin/v1/skins").then((data) => {
      setUses(Object.fromEntries(data.items.map((item) => [item.slug, item.storeCount])));
    });
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="t-title">스킨</h1>
          <p>TV 화면 테마를 고르고 강조 색 · 로고 · 휴식 이미지 · BGM만 바꿔요. 화면 구성은 템플릿이 지켜줘요.</p>
        </div>
        <div className="row">
          <span className="t-sm subtle" style={{ marginRight: 4 }}>
            저장하지 않은 변경 2개
          </span>
          <button type="button" className="btn btn-ghost">
            되돌리기
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setNote("스킨 저장 API가 아직 없어요. 목록과 지점 수만 서버에서 가져와요.")}
          >
            <Check className="i" aria-hidden />
            저장하고 적용
          </button>
        </div>
      </div>
      {note ? <p className="form-error" style={{ marginTop: -8 }}>{note}</p> : null}
      <div className="skin-layout">
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <article className="card">
            <div className="card-head" style={{ minHeight: 52, padding: "12px 20px" }}>
              <div className="row" style={{ gap: 12 }}>
                <h2 className="t-h2">미리보기</h2>
                <span className="badge badge-outline">1920×1080</span>
              </div>
              <div className="seg">
                {(
                  [
                    ["exercise", "운동"],
                    ["next", "NEXT 예고"],
                    ["rest", "휴식"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" className={frame === id ? "on" : undefined} onClick={() => setFrame(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body" style={{ padding: "0 20px 20px" }}>
              <div className="preview">
                {current.id === "neon" ? (
                  <img src={FRAMES[frame].src} alt={FRAMES[frame].alt} />
                ) : (
                  <div className={`shot ${current.mock}`}>
                    <Mini kind={current.mock ?? ""} />
                  </div>
                )}
              </div>
            </div>
          </article>
          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <h2 className="t-h2">
                템플릿 <span className="subtle" style={{ fontWeight: 500 }}>5</span>
              </h2>
              <span className="t-sm subtle">템플릿을 바꿔도 프로그램은 그대로예요</span>
            </div>
            <div className="tpl-grid">
              {TEMPLATES.map((item) => (
                <button key={item.id} type="button" className={item.id === template ? "tpl on" : "tpl"} onClick={() => setTemplate(item.id)}>
                  <div className={item.mock ? `shot ${item.mock}` : "shot"}>
                    {item.id === "neon" ? <img src="/media/skin-neon-exercise.jpg" alt="" /> : <Mini kind={item.mock ?? ""} />}
                  </div>
                  {item.id === template ? (
                    <span className="sel-mark">
                      <Check className="i" style={{ width: 12, height: 12 }} strokeWidth={3} aria-hidden />
                    </span>
                  ) : null}
                  <b>{item.name}</b>
                  <small>{uses[item.id] == null ? item.use : uses[item.id] === 0 ? "사용 중인 지점 없음" : `${uses[item.id]}개 지점 사용 중`}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head" style={{ minHeight: 52, padding: "12px 20px" }}>
            <h2 className="t-h2">꾸미기</h2>
            <span className="badge badge-volt">
              <span className="dot" />
              {current.name}
            </span>
          </div>
          <div className="card-body" style={{ padding: "4px 20px 20px", display: "grid", gap: 20 }}>
            <div className="field">
              <span className="label">적용 지점</span>
              <div className="select">
                <span>6개 지점 · 삼성코엑스점 외 5곳</span>
                <ChevronDown className="i i-sm" aria-hidden />
              </div>
            </div>
            <div className="field">
              <span className="label">강조 색</span>
              <div className="swatches">
                {COLORS.map((hex) => (
                  <button key={hex} type="button" className={color === hex ? "sw on" : "sw"} style={{ background: hex }} aria-label={hex} onClick={() => setColor(hex)} />
                ))}
                <button type="button" className="sw add" aria-label="색 추가">
                  <Plus className="i i-sm" aria-hidden />
                </button>
              </div>
              <span className="hint">
                타이머 · 진행 바 · NEXT 표시에 쓰여요 · <span className="mono">{color}</span>
              </span>
            </div>
            <div className="field">
              <span className="label">로고</span>
              <div className="asset">
                <span className="th" style={{ background: "var(--ink-950)" }}>
                  <img src="/brand/a-v-forward-icon.svg" alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
                </span>
                <div className="grow">
                  <b>moveon-logo.svg</b>
                  <small>오른쪽 위 · 높이 48px</small>
                </div>
                <button type="button" className="btn btn-ghost btn-sm">
                  교체
                </button>
              </div>
            </div>
            <div className="field">
              <span className="label">휴식 화면 이미지</span>
              <div className="asset">
                <span className="th">
                  <img src="/media/rest-image.jpg" alt="" />
                </span>
                <div className="grow">
                  <b>rest-neon-gym.jpg</b>
                  <small>1280×720 · 161KB</small>
                </div>
                <button type="button" className="btn btn-ghost btn-sm">
                  교체
                </button>
              </div>
            </div>
            <div className="field">
              <span className="label">BGM</span>
              <div className="bgm">
                <button type="button" className="pl" aria-label="재생">
                  <Play className="i" aria-hidden />
                </button>
                <div className="grow">
                  <b className="t-sm" style={{ fontWeight: 600 }}>
                    Neon Drive
                  </b>
                  <div className="wave" aria-hidden>
                    {WAVE.map((height, index) => (
                      <i key={index} className={index < 14 ? "on" : undefined} style={{ height }} />
                    ))}
                  </div>
                </div>
                <span className="mono subtle">128 BPM</span>
              </div>
            </div>
            <div className="empty">
              <div className="ic">
                <CalendarClock className="i" aria-hidden />
              </div>
              <b>예약된 스킨 변경이 없어요</b>
              <p>
                연말 시즌처럼 정해진 기간에만
                <br />
                다른 스킨을 쓰고 싶다면 예약해 두세요
              </p>
              <button type="button" className="btn btn-secondary btn-sm">
                <Plus className="i" aria-hidden />
                기간 예약 추가
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
