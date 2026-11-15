type ScreenName = "pair" | "list" | "play" | "done";
type Program = {
  id: string;
  name: string;
  publishedVersion: number;
  publishedAt: string;
};
type ProgramDetail = Program & {
  playItems: Array<{ index: number; durationSec: number }>;
  skin: { id: string; options: Record<string, unknown> };
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

function initPairing() {
  const container = $("code-inputs");
  const inputs: HTMLInputElement[] = [];
  for (let i = 0; i < 6; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 1;
    input.pattern = "[0-9]";
    input.inputMode = "numeric";
    input.dataset.index = String(i);
    inputs.push(input);
    container.appendChild(input);
  }
  const pairBtn = $<HTMLButtonElement>("pair-btn");
  const errorEl = $("pair-error");

  function getCode() {
    return inputs.map((i) => i.value).join("");
  }

  function updateBtn() {
    pairBtn.disabled = getCode().length !== 6;
  }

  inputs.forEach((input, idx) => {
    input.addEventListener("input", () => {
      const val = input.value.replace(/\D/g, "");
      input.value = val.slice(0, 1);
      if (val && idx < 5) inputs[idx + 1].focus();
      updateBtn();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && idx > 0) {
        inputs[idx - 1].focus();
      }
      if (e.key === "ArrowLeft" && idx > 0) inputs[idx - 1].focus();
      if (e.key === "ArrowRight" && idx < 5) inputs[idx + 1].focus();
      if (e.key === "Enter") {
        e.preventDefault();
        if (getCode().length === 6) void doPair();
      }
    });
  });

  async function doPair() {
    errorEl.textContent = "";
    showLoading(true);
    try {
      const { token } = await api<{ token: string }>("/player/v1/pair", {
        method: "POST",
        body: JSON.stringify({ code: getCode() }),
      });
      deviceToken = token;
      localStorage.setItem(TOKEN_KEY, token);
      await loadPrograms();
      showScreen("list");
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : "페어링 실패";
    } finally {
      showLoading(false);
    }
  }

  pairBtn.addEventListener("click", () => void doPair());
  inputs[0].focus();
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
  skinIframe = document.createElement("iframe");
  skinIframe.src = "/skins/neon-arcade/index.html";
  skinIframe.allow = "autoplay";
  wrap.appendChild(skinIframe);

  skinIframe.onload = () => {
    skinIframe?.contentWindow?.postMessage({ type: "mvn:program", program }, "*");
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
  skinIframe = null;
  isPaused = false;
  pauseOverlay.classList.remove("show");
}

function togglePause() {
  if (currentScreen !== "play") return;
  isPaused = !isPaused;
  pauseOverlay.classList.toggle("show", isPaused);
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
