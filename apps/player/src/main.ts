type ScreenName = "pair" | "list" | "play" | "done";
type Program = {
  id: string;
  name: string;
  publishedVersion: number;
  publishedAt: string;
};
type ProgramDetail = Program & {
  playItems: Array<{ index: number; durationSec: number }>;
  skin: { id: string; kind?: string; options: Record<string, unknown>; screens?: Record<string, unknown> };
  videos: Record<string, unknown>;
};

const TOKEN_KEY = "mvn_device_token";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const screens: Record<ScreenName, HTMLElement> = {
  pair: $("pair-screen"),
  list: $("list-screen"),
  play: $("play-screen"),
  done: $("done-screen"),
};
const loadingOverlay = $("loading-overlay");
const pauseOverlay = $("pause-overlay");
const errorOverlay = $("error-overlay");

let currentScreen: ScreenName = "pair";
let programs: Program[] = [];
let selectedProgram: Program | null = null;
let deviceToken: string | null = null;
let isPaused = false;
let skinIframe: HTMLIFrameElement | null = null;
let htmlSkinPlayer: import("./html-skin-player").HtmlSkinPlayer | null = null;

function showScreen(name: ScreenName) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("active", key === name);
  });
  currentScreen = name;
}

function showLoading(show: boolean) {
  loadingOverlay.classList.toggle("show", show);
}

function showError(msg: string) {
  $("error-msg").textContent = msg;
  errorOverlay.classList.add("show");
}

function hideError() {
  errorOverlay.classList.remove("show");
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (deviceToken) headers["X-Device-Token"] = deviceToken;
  const res = await fetch(path, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || `HTTP ${res.status}`);
  }
  return res.json();
}

var pairingPollTimer: number | null = null;

function initPairing() {
  var codeDisplay = $("code-display");
  var statusEl = $("pair-status");
  var errorEl = $("pair-error");
  var currentCode = "";

  async function requestCode() {
    errorEl.textContent = "";
    statusEl.textContent = "코드 발급 중...";
    codeDisplay.textContent = "------";
    try {
      var res = await api<{ code: string; expiresAt: string }>("/player/v1/code", { method: "POST" });
      currentCode = res.code;
      codeDisplay.textContent = res.code;
      statusEl.textContent = "관리자 화면에서 이 코드를 입력하세요";
      startPolling();
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : "코드 발급 실패";
      statusEl.textContent = "5초 후 재시도...";
      setTimeout(function() { requestCode(); }, 5000);
    }
  }

  function startPolling() {
    if (pairingPollTimer) clearInterval(pairingPollTimer);
    pairingPollTimer = window.setInterval(function() { checkStatus(); }, 3000);
  }

  async function checkStatus() {
    if (!currentCode) return;
    try {
      var res = await api<{ status: string; token?: string }>("/player/v1/code/" + currentCode + "/status");
      if (res.status === "approved" && res.token) {
        if (pairingPollTimer) clearInterval(pairingPollTimer);
        deviceToken = res.token;
        localStorage.setItem(TOKEN_KEY, res.token);
        statusEl.textContent = "승인 완료!";
        await loadPrograms();
        showScreen("list");
      } else if (res.status === "expired") {
        statusEl.textContent = "코드 만료, 재발급 중...";
        requestCode();
      }
    } catch (err) {
      // polling error, continue
    }
  }

  requestCode();
}

async function loadPrograms() {
  showLoading(true);
  try {
    const res = await api<{ items: Program[] }>("/player/v1/programs");
    programs = res.items;
    renderPrograms();
  } catch (err) {
    showError(err instanceof Error ? err.message : "프로그램 목록 불러오기 실패");
  } finally {
    showLoading(false);
  }
}

function renderPrograms() {
  const list = $("program-list");
  list.innerHTML = "";
  const playBtn = $<HTMLButtonElement>("play-btn");
  programs.forEach((prog, idx) => {
    const item = document.createElement("div");
    item.className = "program-item";
    item.tabIndex = 0;
    item.innerHTML = `
      <div class="program-name">${prog.name}</div>
      <div class="program-meta">v${prog.publishedVersion} · ${new Date(prog.publishedAt).toLocaleString("ko-KR")}</div>
    `;
    item.addEventListener("click", () => selectProgram(prog, item));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectProgram(prog, item);
      }
      if (e.key === "ArrowDown" && idx < programs.length - 1) {
        (list.children[idx + 1] as HTMLElement).focus();
      }
      if (e.key === "ArrowUp" && idx > 0) {
        (list.children[idx - 1] as HTMLElement).focus();
      }
    });
    list.appendChild(item);
  });
  if (programs.length) {
    selectProgram(programs[0], list.children[0] as HTMLElement);
    (list.children[0] as HTMLElement).focus();
  }

  playBtn.addEventListener("click", () => void startPlay());
}

function selectProgram(prog: Program, el: HTMLElement) {
  selectedProgram = prog;
  document.querySelectorAll(".program-item").forEach((item) => item.classList.remove("selected"));
  el.classList.add("selected");
  $<HTMLButtonElement>("play-btn").disabled = false;
}

async function startPlay() {
  if (!selectedProgram) return;
  showLoading(true);
  hideError();
  try {
    const detail = await api<ProgramDetail>(`/player/v1/programs/${selectedProgram.id}`);
    showScreen("play");
    launchSkin(detail);
  } catch (err) {
    showError(err instanceof Error ? err.message : "프로그램 불러오기 실패");
  } finally {
    showLoading(false);
  }
}

function launchSkin(program: ProgramDetail) {
  const wrap = $("player-wrap");
  wrap.innerHTML = "";
  if (program.skin?.kind === "html") {
    void import("./html-skin-player").then(({ HtmlSkinPlayer }) => {
      htmlSkinPlayer = new HtmlSkinPlayer(wrap, {
        onDone: () => {
          cleanup();
          showScreen("done");
        },
      });
      htmlSkinPlayer.start(program as never);
    });
    return;
  }
  skinIframe = document.createElement("iframe");
  skinIframe.src = "/skins/neon-arcade/index.html";
  skinIframe.allow = "autoplay";
  wrap.appendChild(skinIframe);

  skinIframe.onload = () => {
    skinIframe?.contentWindow?.postMessage({ type: "mvn:program", program, loop: false }, "*");
  };

  window.addEventListener("message", onSkinMessage);
}

function onSkinMessage(ev: MessageEvent) {
  if (ev.data?.type === "mvn:done") {
    cleanup();
    showScreen("done");
  }
}

function cleanup() {
  window.removeEventListener("message", onSkinMessage);
  htmlSkinPlayer?.destroy();
  htmlSkinPlayer = null;
  skinIframe = null;
  isPaused = false;
  pauseOverlay.classList.remove("show");
}

function togglePause() {
  if (currentScreen !== "play") return;
  isPaused = !isPaused;
  pauseOverlay.classList.toggle("show", isPaused);
  if (htmlSkinPlayer) {
    htmlSkinPlayer.setPaused(isPaused);
    return;
  }
  skinIframe?.contentWindow?.postMessage({ type: isPaused ? "mvn:pause" : "mvn:resume" }, "*");
}

function handleKeydown(e: KeyboardEvent) {
  if (currentScreen === "play") {
    if (e.key === "Enter" || e.keyCode === 13) {
      e.preventDefault();
      togglePause();
    }
    if (e.key === "Escape" || e.key === "GoBack" || e.keyCode === 10009) {
      e.preventDefault();
      cleanup();
      showScreen("list");
    }
  }
  if (currentScreen === "done" && (e.key === "Enter" || e.keyCode === 13)) {
    e.preventDefault();
    showScreen("list");
    (document.querySelector(".program-item") as HTMLElement)?.focus();
  }
}

function init() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  const saved = localStorage.getItem(TOKEN_KEY);
  if (saved) {
    deviceToken = saved;
    loadPrograms().then(() => showScreen("list")).catch(() => showScreen("pair"));
  } else {
    initPairing();
  }

  $("back-btn").addEventListener("click", () => {
    showScreen("list");
    (document.querySelector(".program-item") as HTMLElement)?.focus();
  });

  $("retry-btn").addEventListener("click", () => {
    hideError();
    void startPlay();
  });

  window.addEventListener("keydown", handleKeydown);
}

init();
