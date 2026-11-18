#!/usr/bin/env node
/**
 * HTML 스킨 E2E: neon-arcade kind=html 화면·draft 검증(4건)·발행→플레이어/관리자 스냅샷 (7단계)
 * API=http://localhost:3011 (기본) — 사용자 dev 3001과 분리
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { HTML_SKIN_SAMPLE_TOKENS } from "../packages/shared/dist/index.js";

const API = process.env.API || "http://localhost:3011";
const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_VIDEO = join(__dirname, "..", "apps/admin/public/skins/neon-arcade/loop_x10.mp4");
const NEON_MANIFEST = JSON.parse(
  readFileSync(join(__dirname, "..", "packages/shared/neon-arcade-screens/manifest.json"), "utf8"),
);
const EXPECTED_SCREEN_TITLES = NEON_MANIFEST.screens.map((s) => s.title);

let token = "";
let videoId = "";
let programId = "";
let deviceToken = "";

const cleanupIds = { videos: [], programs: [], devices: [] };

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

async function fail(step, msg) {
  console.error(`[${step}] FAILED: ${msg}`);
  await cleanup().catch(() => {});
  process.exit(1);
}

async function request(method, path, { body, headers = {}, expectStatus } = {}) {
  const h = { ...headers };
  if (body !== undefined && !(body instanceof FormData)) {
    h["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`${method} ${path} → ${res.status} (expected ${expectStatus}): ${text.slice(0, 400)}`);
  }
  if (expectStatus === undefined && !res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return { status: res.status, json };
}

async function authed(method, path, opts) {
  return request(method, path, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts?.headers } });
}

async function cleanup() {
  log("cleanup", "테스트 데이터 정리...");
  for (const id of cleanupIds.programs) {
    try {
      await authed("DELETE", `/admin/v1/programs/${id}`);
    } catch {
      /* ignore */
    }
  }
  for (const id of cleanupIds.videos) {
    try {
      await authed("DELETE", `/admin/v1/videos/${id}`);
    } catch {
      /* ignore */
    }
  }
  for (const id of cleanupIds.devices) {
    try {
      await authed("DELETE", `/admin/v1/devices/${id}`);
    } catch {
      /* ignore */
    }
  }
}

function screenByTitle(screens, title) {
  const row = screens.find((s) => s.title === title);
  if (!row) throw new Error(`화면 '${title}' 없음`);
  return row;
}

/** html-preview-screenshots.mjs fillCssTokens와 동일; HTML은 iframe 런타임에서 postMessage로 치환됨 */
function fillSkinTokens(content, tokens) {
  return content.replace(/\{\{([^{}]+)\}\}/g, (_, key) => {
    const v = tokens[String(key).trim()];
    return v == null ? "" : String(v);
  });
}

const INLINE_EVENT_HANDLER_RE = /\bon\w+\s*=/i;

async function step1_login() {
  log("1", "로그인...");
  const { json } = await request("POST", "/admin/v1/auth/login", {
    body: { email: "inkuk.yang@mvmfit.kr", password: "password" },
  });
  if (!json.accessToken) fail("1", `토큰 없음: ${JSON.stringify(json)}`);
  token = json.accessToken;
  log("1", "로그인 성공");
}

async function step2_neonArcadeHtmlScreens() {
  log("2", "neon-arcade HTML 스킨·화면 10종 확인...");
  const { json } = await authed("GET", "/admin/v1/skins");
  const skin = (json.items || []).find((s) => s.slug === "neon-arcade");
  if (!skin) fail("2", "neon-arcade 스킨 없음 — seed-html-skin 실행 필요");
  if (skin.kind !== "html") fail("2", `neon-arcade kind=${skin.kind} (html 기대)`);
  const { json: screensRes } = await authed("GET", `/admin/v1/skins/${skin.id}/screens`);
  const screens = screensRes.items || [];
  if (screens.length !== 10) fail("2", `화면 ${screens.length}개 (10개 기대)`);
  const titles = screens.map((s) => s.title);
  if (JSON.stringify(titles) !== JSON.stringify(EXPECTED_SCREEN_TITLES)) {
    fail("2", `화면 제목 불일치: ${titles.join(", ")}`);
  }
  const warmup = screenByTitle(screens, "웜업");
  const rest = screenByTitle(screens, "휴식");
  if (!warmup.hasVideoSlot) fail("2", "웜업 화면 hasVideoSlot 기대");
  if (!rest.hasNextVideoSlot) fail("2", "휴식 화면 hasNextVideoSlot 기대");
  if (!warmup.html?.includes("na-stage")) fail("2", "웜업 html에 na-stage 기대");
  for (const sc of screens) {
    if (!sc.html?.trim() || !sc.css?.trim()) fail("2", `화면 '${sc.title}' html/css 비어 있음`);
    if (typeof sc.version !== "number" || sc.version < 1) fail("2", `화면 '${sc.title}' version 기대`);
  }
  log("2", `OK: kind=html, 화면 ${screens.length}개`);
  return { skin, screens, warmup, rest };
}

async function step3_resolveVideo() {
  const forceUpload = process.env.E2E_UPLOAD_VIDEO === "1";
  if (!forceUpload) {
    log("3", "기존 ready 영상 재사용...");
    const { json } = await authed("GET", "/admin/v1/videos");
    const ready = (json.items || []).find((v) => v.status === "ready" && v.durationSec > 0);
    if (ready) {
      videoId = ready.id;
      log("3", `재사용: ${ready.name} (${videoId.slice(0, 8)}…, ${ready.durationSec}초)`);
      return ready.durationSec;
    }
    log("3", "ready 영상 없음 — 업로드 시도 (ffmpeg 필요)");
  } else {
    log("3", "영상 업로드 (E2E_UPLOAD_VIDEO=1)...");
  }

  if (!existsSync(SAMPLE_VIDEO)) {
    fail("3", `샘플 영상 없음: ${SAMPLE_VIDEO}`);
  }

  const form = new FormData();
  const bytes = readFileSync(SAMPLE_VIDEO);
  form.append("file", new Blob([bytes], { type: "video/mp4" }), "loop_x10.mp4");
  form.append("name", "E2E HTML 스킨 영상");
  const { json } = await authed("POST", "/admin/v1/videos/upload", { body: form });
  if (!json.id) fail("3", `업로드 실패: ${JSON.stringify(json)}`);
  videoId = json.id;
  cleanupIds.videos.push(videoId);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const { json: video } = await authed("GET", `/admin/v1/videos/${videoId}`);
    if (video.status === "ready") {
      log("3", `영상 준비 완료 (durationSec=${video.durationSec})`);
      return video.durationSec;
    }
    if (video.status === "failed") {
      const hint = video.error?.includes("ffmpeg")
        ? " (ffmpeg 미설치 — 시드 ready 영상이 있으면 E2E_UPLOAD_VIDEO 없이 재실행)"
        : "";
      fail("3", `영상 처리 실패${hint}: ${video.error || ""}`);
    }
  }
  fail("3", "영상 처리 타임아웃");
}

async function step4_validationRejectsBadDraft(warmup, rest, videoDuration) {
  const skinOpts = { id: "neon-arcade", options: { pointColor: "#C8F31D", nextLeadSec: 3 } };

  log("4", "screenId 없는 draft 저장 거부...");
  try {
    await authed("POST", "/admin/v1/programs", {
      body: {
        name: "E2E HTML 검증 실패용",
        draft: {
          items: [{ id: "ex-1", type: "exercise", durationSec: 10, label: "x", videoId }],
          skin: skinOpts,
        },
      },
      expectStatus: 400,
    });
    log("4", "OK: 400");
  } catch (e) {
    fail("4", e.message);
  }

  log("4b", "영상 슬롯 화면에 videoId 없으면 거부...");
  try {
    await authed("POST", "/admin/v1/programs", {
      body: {
        name: "E2E HTML 검증 실패용 2",
        draft: {
          items: [{ id: "ex-1", type: "exercise", durationSec: 10, label: "x", screenId: warmup.id }],
          skin: skinOpts,
        },
      },
      expectStatus: 400,
    });
    log("4b", "OK: 400");
  } catch (e) {
    fail("4b", e.message);
  }

  log("4c", "영상 슬롯 없는 화면에 videoId 있으면 거부...");
  try {
    await authed("POST", "/admin/v1/programs", {
      body: {
        name: "E2E HTML 검증 실패용 3",
        draft: {
          items: [{ id: "rest-bad", type: "rest", durationSec: 5, label: "x", screenId: rest.id, videoId }],
          skin: skinOpts,
        },
      },
      expectStatus: 400,
    });
    log("4c", "OK: 400");
  } catch (e) {
    fail("4c", e.message);
  }

  log("4d", "알 수 없는 screenId면 거부...");
  try {
    await authed("POST", "/admin/v1/programs", {
      body: {
        name: "E2E HTML 검증 실패용 4",
        draft: {
          items: [
            {
              id: "ex-bad-screen",
              type: "exercise",
              durationSec: 10,
              label: "x",
              screenId: "00000000-0000-4000-8000-000000000000",
              videoId,
            },
          ],
          skin: skinOpts,
        },
      },
      expectStatus: 400,
    });
    log("4d", "OK: 400");
  } catch (e) {
    fail("4d", e.message);
  }

  return videoDuration ?? 10;
}

async function step5_createPublish(warmup, rest, durationSec) {
  log("5", "HTML 스킨 프로그램 생성·게시...");
  const dur = Math.max(1, Math.floor(durationSec) || 10);
  const { json } = await authed("POST", "/admin/v1/programs", {
    body: {
      name: "E2E HTML 스킨 프로그램",
      draft: {
        items: [
          {
            id: "ex-warmup",
            type: "exercise",
            durationSec: dur,
            label: "웜업 루프",
            screenId: warmup.id,
            videoId,
          },
          {
            id: "rest-1",
            type: "rest",
            durationSec: 5,
            label: "휴식",
            screenId: rest.id,
          },
        ],
        skin: { id: "neon-arcade", options: { pointColor: "#C8F31D", nextLeadSec: 3 } },
      },
    },
  });
  if (!json.id) fail("5", `생성 실패: ${JSON.stringify(json)}`);
  programId = json.id;
  cleanupIds.programs.push(programId);
  const pub = await authed("POST", `/admin/v1/programs/${programId}/publish`);
  if (!pub.json.publishedVersion) fail("5", `게시 실패: ${JSON.stringify(pub.json)}`);
  log("5", `게시 v${pub.json.publishedVersion}`);
}

async function step6_playerSnapshot(warmup, rest, durationSec) {
  log("6", "플레이어 페어링·HTML 스냅샷 확인...");
  const codeRes = await request("POST", "/player/v1/code");
  if (!codeRes.json.code) fail("6", "코드 발급 실패");
  const approve = await authed("POST", "/admin/v1/approve-pairing", { body: { code: codeRes.json.code } });
  if (!approve.json.ok) fail("6", "승인 실패");
  if (approve.json.device?.id) cleanupIds.devices.push(approve.json.device.id);

  const status = await request("GET", `/player/v1/code/${codeRes.json.code}/status`);
  if (!status.json.token) fail("6", "디바이스 토큰 없음");
  deviceToken = status.json.token;

  const detail = await request("GET", `/player/v1/programs/${programId}`, {
    headers: { "X-Device-Token": deviceToken },
  });
  const snap = detail.json;
  if (snap.skin?.id !== "neon-arcade") fail("6", `skin.id=${snap.skin?.id}`);
  if (snap.skin?.kind !== "html") fail("6", `skin.kind=${snap.skin?.kind}`);
  if (snap.skin?.options?.pointColor !== "#C8F31D") fail("6", "skin.options.pointColor 불일치");
  const screens = snap.skin?.screens;
  if (!screens || typeof screens !== "object") fail("6", "skin.screens 없음");
  const screenIds = Object.keys(screens).sort();
  const expectedFrozen = [warmup.id, rest.id].sort();
  if (JSON.stringify(screenIds) !== JSON.stringify(expectedFrozen)) {
    fail("6", `동결 화면 ${screenIds.join(",")} (기대: ${expectedFrozen.join(",")})`);
  }
  const frozenWarmup = screens[warmup.id];
  const frozenRest = screens[rest.id];
  if (!frozenWarmup?.hasVideoSlot) fail("6", "동결 웜업 hasVideoSlot 기대");
  if (!frozenRest?.hasNextVideoSlot) fail("6", "동결 휴식 hasNextVideoSlot 기대");
  for (const id of screenIds) {
    const sc = screens[id];
    if (!sc.html?.includes("na-stage") && !sc.html?.trim()) {
      fail("6", `화면 ${id} html 비어 있음`);
    }
    if (!sc.css?.trim()) fail("6", `화면 ${id} css 비어 있음`);
    if (typeof sc.version !== "number" || sc.version < 1) fail("6", `화면 ${id} version 기대`);
  }
  const playItems = snap.playItems || [];
  if (playItems.length !== 2) fail("6", `playItems ${playItems.length}개 (2개 기대)`);
  const warmupPlay = playItems.find((p) => p.screenId === warmup.id);
  const restPlay = playItems.find((p) => p.screenId === rest.id);
  if (!warmupPlay?.video?.url) fail("6", "웜업 playItem에 video.url 기대");
  if (restPlay?.video) fail("6", "휴식 playItem에 video 없어야 함");
  const expectedDur = Math.max(1, Math.floor(durationSec) || 10);
  if (warmupPlay.durationSec !== expectedDur) fail("6", `웜업 durationSec=${warmupPlay.durationSec} (${expectedDur} 기대)`);
  if (restPlay?.durationSec !== 5) fail("6", `휴식 durationSec=${restPlay?.durationSec}`);
  if (!snap.videos?.[videoId]) fail("6", "videos 스냅샷에 업로드 영상 없음");

  log("6b", "동결 화면 html/css 스크립트·인라인 핸들러·토큰 치환 검증...");
  const sampleTokens = { ...HTML_SKIN_SAMPLE_TOKENS };
  for (const id of screenIds) {
    const sc = screens[id];
    const html = sc.html ?? "";
    if (/<script/i.test(html)) fail("6b", `화면 ${id} html에 <script 금지`);
    if (INLINE_EVENT_HANDLER_RE.test(html)) fail("6b", `화면 ${id} html에 인라인 이벤트 핸들러 금지`);
    const css = sc.css ?? "";
    if (css) {
      if (/<script/i.test(css)) fail("6b", `화면 ${id} css에 <script 금지`);
      if (INLINE_EVENT_HANDLER_RE.test(css)) fail("6b", `화면 ${id} css에 인라인 이벤트 핸들러 금지`);
    }
    const filledHtml = fillSkinTokens(html, sampleTokens);
    if (filledHtml.includes("{{")) {
      fail("6b", `화면 ${id} html 샘플 토큰 치환 후 '{{' 잔존`);
    }
    if (css) {
      const filledCss = fillSkinTokens(css, sampleTokens);
      if (filledCss.includes("{{")) {
        fail("6b", `화면 ${id} css 샘플 토큰 치환 후 '{{' 잔존`);
      }
    }
  }
  log("6b", `OK: frozen screens=${screenIds.length}`);

  log("6", `OK: skin.kind=html, screens=${screenIds.length}, playItems=${playItems.length}`);
}

async function step7_adminPublishSnapshot() {
  log("7", "관리자 발행 스냅샷·needsRepublish 확인...");
  const { json: prog } = await authed("GET", `/admin/v1/programs/${programId}`);
  if (prog.status !== "published") fail("7", `status=${prog.status}`);
  if (prog.needsRepublish) {
    const diff = prog.republishDiff?.length ? prog.republishDiff.join(", ") : "(no republishDiff)";
    fail("7", `needsRepublish=true (false 기대); republishDiff: ${diff}`);
  }
  if (!prog.publishedVersion) fail("7", "publishedVersion 없음");

  const { json: versionsRes } = await authed("GET", `/admin/v1/programs/${programId}/versions`);
  const latest = (versionsRes.items || []).find((v) => v.version === prog.publishedVersion);
  if (!latest) fail("7", "발행 버전 행 없음");
  const frozen = latest.skin?.screens;
  if (!frozen || Object.keys(frozen).length !== 2) {
    fail("7", `버전 스냅샷 동결 화면 ${Object.keys(frozen || {}).length}개`);
  }
  log("7", `OK: v${prog.publishedVersion}, stepCount=${latest.stepCount ?? "?"}`);
}

async function main() {
  console.log(`=== HTML Skin E2E (API=${API}) ===\n`);
  try {
    const health = await fetch(`${API}/health`);
    if (!health.ok) fail("0", `/health ${health.status}`);
    await step1_login();
    const { warmup, rest } = await step2_neonArcadeHtmlScreens();
    const durationSec = await step3_resolveVideo();
    await step4_validationRejectsBadDraft(warmup, rest, durationSec);
    await step5_createPublish(warmup, rest, durationSec);
    await step6_playerSnapshot(warmup, rest, durationSec);
    await step7_adminPublishSnapshot();
    console.log("\n=== ALL STEPS PASSED ===");
    await cleanup();
  } catch (err) {
    console.error("\nError:", err.message);
    await cleanup();
    process.exit(1);
  }
}

main();