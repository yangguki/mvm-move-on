import {
  buildHtmlSkinSrcdoc,
  parseHtmlSkinStepText,
  parseYouTubeVideoId,
  resolveStepScreen,
  youtubeThumbnailUrl,
  type HtmlSkinScreensMap,
  type PlayItem,
  type PublishedSnapshot,
  type SkinScreenSnapshot,
} from "@mvn/shared";
import {
  loadYouTubeIframeApi,
  youtubeCoverTransform,
  youtubePlayerVars,
  type YouTubeIframeApi,
} from "./youtube-iframe-api";

type HtmlSkinProgram = PublishedSnapshot & {
  playItems: PlayItem[];
  publishedVersion: number;
  publishedAt: string;
};

type SlotRect = { left: number; top: number; width: number; height: number };

type SlotMount = {
  slot: "main" | "next";
  el: HTMLElement;
  kind: "video" | "youtube" | "thumbnail";
  ytPlayer?: { destroy: () => void; pauseVideo: () => void; playVideo: () => void };
};

const FALLBACK_HTML = `
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#111;color:#fff;font-family:system-ui,sans-serif">
  <h1 style="font-size:64px;margin:0 0 24px">{{label}}</h1>
  <p style="font-size:120px;margin:0;color:{{pointColor}}">{{remainingSec}}</p>
  <div data-mvn-video style="width:640px;height:360px;background:#333;margin-top:32px;border-radius:16px"></div>
</div>
`.trim();

const FALLBACK_CSS = "";

export type HtmlSkinPlayerCallbacks = {
  onDone: () => void;
};

export class HtmlSkinPlayer {
  private wrap: HTMLElement;
  private iframe: HTMLIFrameElement | null = null;
  private slotMounts: SlotMount[] = [];
  private timer: number | null = null;
  private index = 0;
  private program: HtmlSkinProgram | null = null;
  private callbacks: HtmlSkinPlayerCallbacks;
  private scale = 1;
  private stageOffsetX = 0;
  private stageOffsetY = 0;
  private slotRects: { main?: SlotRect; next?: SlotRect } = {};
  private resizeObserver: ResizeObserver | null = null;
  private relayoutRaf: number | null = null;
  private paused = false;
  private tickLeft = 0;
  private tickItem: PlayItem | null = null;
  private tickPlayIndex = 0;
  private currentScreen: SkinScreenSnapshot | null = null;
  private currentItem: PlayItem | null = null;
  private mountGeneration = 0;

  constructor(wrap: HTMLElement, callbacks: HtmlSkinPlayerCallbacks) {
    this.wrap = wrap;
    this.callbacks = callbacks;
    window.addEventListener("message", this.onMessage);
    window.addEventListener("resize", this.relayout);
    this.resizeObserver = new ResizeObserver(() => this.relayout());
    this.resizeObserver.observe(wrap);
  }

  destroy(): void {
    this.stopTimer();
    this.clearSlotMounts();
    if (this.iframe) this.iframe.remove();
    this.iframe = null;
    if (this.relayoutRaf != null) {
      cancelAnimationFrame(this.relayoutRaf);
      this.relayoutRaf = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener("message", this.onMessage);
    window.removeEventListener("resize", this.relayout);
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.stopTimer();
    } else {
      this.startTickTimer();
    }
    this.slotMounts.forEach((mount) => {
      if (mount.kind === "video") {
        const video = mount.el as HTMLVideoElement;
        if (paused) video.pause();
        else void video.play();
        return;
      }
      if (mount.kind === "youtube" && mount.ytPlayer) {
        if (paused) mount.ytPlayer.pauseVideo();
        else mount.ytPlayer.playVideo();
      }
    });
  }

  start(program: HtmlSkinProgram): void {
    this.program = program;
    this.index = 0;
    this.paused = false;
    this.wrap.innerHTML = "";
    this.wrap.style.position = "relative";
    this.wrap.style.width = "100%";
    this.wrap.style.height = "100%";
    this.wrap.style.overflow = "hidden";
    this.iframe = document.createElement("iframe");
    this.iframe.className = "mvn-html-skin-iframe";
    this.iframe.setAttribute("sandbox", "allow-scripts");
    this.iframe.style.position = "absolute";
    this.iframe.style.left = "0";
    this.iframe.style.top = "0";
    this.iframe.style.width = "1920px";
    this.iframe.style.height = "1080px";
    this.iframe.style.border = "0";
    this.iframe.style.background = "transparent";
    this.iframe.style.transformOrigin = "top left";
    this.iframe.style.zIndex = "0";
    this.wrap.appendChild(this.iframe);
    this.relayout();
    this.showStep(0);
  }

  private relayout = (): void => {
    if (!this.iframe) return;
    if (!this.wrap.clientWidth || !this.wrap.clientHeight) {
      if (this.relayoutRaf == null) {
        this.relayoutRaf = requestAnimationFrame(() => {
          this.relayoutRaf = null;
          this.relayout();
        });
      }
      return;
    }
    const scaleX = this.wrap.clientWidth / 1920;
    const scaleY = this.wrap.clientHeight / 1080;
    this.scale = Math.min(scaleX, scaleY);
    const stageW = 1920 * this.scale;
    const stageH = 1080 * this.scale;
    this.stageOffsetX = (this.wrap.clientWidth - stageW) / 2;
    this.stageOffsetY = (this.wrap.clientHeight - stageH) / 2;
    this.iframe.style.left = `${this.stageOffsetX}px`;
    this.iframe.style.top = `${this.stageOffsetY}px`;
    this.iframe.style.transform = `scale(${this.scale})`;
    this.positionSlotMounts();
  };

  private screensMap(): HtmlSkinScreensMap {
    return this.program?.skin?.screens ?? {};
  }

  private orderedScreens(): SkinScreenSnapshot[] {
    const map = this.screensMap();
    return Object.values(map);
  }

  private onMessage = (ev: MessageEvent): void => {
    if (ev.data?.type !== "mvn:html-skin-slot" || !this.iframe) return;
    const slot = ev.data.slot === "next" ? "next" : "main";
    const rect = ev.data.rect;
    if (rect && typeof rect.left === "number") {
      this.slotRects[slot] = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }
    this.positionSlotMounts();
  };

  private stopTimer(): void {
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private clearSlotMounts(): void {
    this.slotMounts.forEach((mount) => {
      try {
        mount.ytPlayer?.destroy();
      } catch {
        /* ignore */
      }
      mount.el.remove();
    });
    this.slotMounts = [];
    this.slotRects = {};
  }

  private postTokens(tokens: Record<string, string | number | boolean>): void {
    this.iframe?.contentWindow?.postMessage({ type: "mvn:html-skin-tokens", tokens }, "*");
  }

  private startTickTimer(): void {
    if (!this.iframe || !this.tickItem || this.paused) return;
    this.stopTimer();
    this.timer = window.setInterval(() => {
      this.tickLeft -= 1;
      if (this.tickLeft <= 0) {
        this.stopTimer();
        this.showStep(this.tickPlayIndex + 1);
        return;
      }
      const t = this.buildTokens(this.tickItem!, this.tickLeft);
      this.postTokens(t);
    }, 1000);
  }

  private showStep(playIndex: number): void {
    if (!this.program || !this.iframe) return;
    const items = this.program.playItems;
    if (playIndex >= items.length) {
      this.callbacks.onDone();
      return;
    }
    this.index = playIndex;
    this.mountGeneration += 1;
    this.stopTimer();
    this.clearSlotMounts();
    const item = items[playIndex];
    const screen =
      resolveStepScreen(item.screenId, this.screensMap(), this.orderedScreens()) ?? {
        id: "fallback",
        title: "fallback",
        html: FALLBACK_HTML,
        css: FALLBACK_CSS,
        hasVideoSlot: true,
        hasNextVideoSlot: false,
        titleOnly: false,
        version: 1,
      };
    this.currentScreen = screen;
    this.currentItem = item;
    const origins = {
      imgSrc: location.origin,
      mediaSrc: location.origin,
      fontSrc: location.origin,
    };
    try {
      this.iframe.srcdoc = buildHtmlSkinSrcdoc(screen.html, screen.css, origins);
    } catch {
      this.iframe.srcdoc = buildHtmlSkinSrcdoc(FALLBACK_HTML, FALLBACK_CSS, origins);
    }
    const remaining = item.durationSec;
    this.tickItem = item;
    this.tickPlayIndex = playIndex;
    this.tickLeft = remaining;
    const tokens = this.buildTokens(item, remaining);
    this.iframe.onload = () => {
      this.postTokens(tokens);
      this.mountSlots(item, screen);
      if (!this.paused) this.startTickTimer();
    };
  }

  private buildTokens(item: PlayItem, remainingSec: number): Record<string, string | number | boolean> {
    const prog = this.program!;
    const next = item.next;
    const meta = parseHtmlSkinStepText(item.text);
    return {
      label: item.label,
      remainingSec,
      totalSec: item.durationSec,
      "next.label": next?.label ?? "",
      "next.afterRest": next?.afterRest ?? false,
      round: meta.round,
      roundTotal: meta.roundTotal,
      stepIndex: item.index + 1,
      stepTotal: prog.playItems.length,
      set: meta.set,
      setTotal: meta.setTotal,
      "program.name": prog.name,
      logoUrl: String(prog.skin.options.logoUrl ?? ""),
      pointColor: prog.skin.options.pointColor ?? "#C8F31D",
    };
  }

  private mountSlots(item: PlayItem, screen: SkinScreenSnapshot): void {
    if (screen.hasVideoSlot && item.video?.url) {
      const url = item.video.url;
      const ytId = parseYouTubeVideoId(url);
      if (ytId) {
        void this.mountMainYouTube(ytId, this.mountGeneration);
      } else {
        const main = this.createSlotVideo(url, "main");
        this.wrap.appendChild(main);
        this.slotMounts.push({ slot: "main", el: main, kind: "video" });
      }
    }
    if (screen.hasNextVideoSlot && item.next?.video?.url) {
      const url = item.next.video.url;
      const ytId = parseYouTubeVideoId(url);
      if (ytId) {
        const thumb = this.createSlotThumbnail(ytId, "next");
        this.wrap.appendChild(thumb);
        this.slotMounts.push({ slot: "next", el: thumb, kind: "thumbnail" });
      } else {
        const next = this.createSlotVideo(url, "next");
        this.wrap.appendChild(next);
        this.slotMounts.push({ slot: "next", el: next, kind: "video" });
      }
    }
    this.positionSlotMounts();
  }

  private async mountMainYouTube(videoId: string, generation: number): Promise<void> {
    const host = this.createYtHost("main");
    this.wrap.appendChild(host);
    const mount: SlotMount = { slot: "main", el: host, kind: "youtube" };
    this.slotMounts.push(mount);
    this.positionSlotMounts();

    let yt: YouTubeIframeApi;
    try {
      yt = await loadYouTubeIframeApi();
    } catch {
      if (generation !== this.mountGeneration) return;
      this.replaceMountWithThumbnail(mount, videoId);
      return;
    }
    if (generation !== this.mountGeneration) return;

    const slot = this.slotRects.main;
    const w = slot && slot.width > 0 ? Math.round(slot.width) : 640;
    const h = slot && slot.height > 0 ? Math.round(slot.height) : 360;

    try {
      const player = new yt.Player(host, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        width: w,
        height: h,
        playerVars: youtubePlayerVars(),
        events: {
          onReady: (event) => {
            if (generation !== this.mountGeneration) return;
            mount.ytPlayer = event.target;
            this.applyYtCover(host, w, h);
            if (!this.paused) event.target.playVideo();
            else event.target.pauseVideo();
          },
          onStateChange: (event) => {
            if (generation !== this.mountGeneration) return;
            if (event.data === yt.PlayerState.ENDED) {
              event.target.seekTo(0, true);
              event.target.playVideo();
            }
          },
          onError: () => {
            if (generation !== this.mountGeneration) return;
            this.replaceMountWithThumbnail(mount, videoId);
          },
        },
      });
      mount.ytPlayer = player;
    } catch {
      if (generation !== this.mountGeneration) return;
      this.replaceMountWithThumbnail(mount, videoId);
    }
  }

  private replaceMountWithThumbnail(mount: SlotMount, videoId: string): void {
    const idx = this.slotMounts.indexOf(mount);
    if (idx === -1) return;
    try {
      mount.ytPlayer?.destroy();
    } catch {
      /* ignore */
    }
    mount.el.remove();
    const thumb = this.createSlotThumbnail(videoId, mount.slot);
    this.wrap.appendChild(thumb);
    this.slotMounts[idx] = { slot: mount.slot, el: thumb, kind: "thumbnail" };
    this.positionSlotMounts();
  }

  private createYtHost(slot: "main" | "next"): HTMLDivElement {
    const host = document.createElement("div");
    host.dataset.slot = slot;
    host.dataset.kind = "youtube";
    host.style.display = "none";
    host.style.position = "absolute";
    host.style.pointerEvents = "none";
    host.style.zIndex = "2";
    host.style.overflow = "hidden";
    return host;
  }

  private applyYtCover(host: HTMLDivElement, slotW: number, slotH: number): void {
    const iframe = host.querySelector("iframe");
    if (!iframe) return;
    const { scale } = youtubeCoverTransform(slotW, slotH);
    iframe.style.position = "absolute";
    iframe.style.left = "50%";
    iframe.style.top = "50%";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.transform = `translate(-50%, -50%) scale(${scale})`;
    iframe.style.transformOrigin = "center center";
    iframe.style.border = "0";
    iframe.style.pointerEvents = "none";
  }

  private resolveMediaUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return new URL(path, window.location.origin).href;
  }

  /** HTML 스킨 슬롯 오버레이 — controls 없음, muted autoplay playsinline loop */
  private createSlotVideo(url: string, slot: "main" | "next"): HTMLVideoElement {
    const video = document.createElement("video");
    video.src = this.resolveMediaUrl(url);
    video.controls = false;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.loop = true;
    video.dataset.slot = slot;
    video.dataset.kind = "video";
    video.style.display = "none";
    video.style.position = "absolute";
    video.style.pointerEvents = "none";
    video.style.zIndex = "2";
    video.addEventListener(
      "loadeddata",
      () => {
        void video.play().catch(() => {});
      },
      { once: true },
    );
    void video.play().catch(() => {});
    return video;
  }

  private createSlotThumbnail(videoId: string, slot: "main" | "next"): HTMLImageElement {
    const img = document.createElement("img");
    img.src = youtubeThumbnailUrl(videoId);
    img.alt = "";
    img.dataset.slot = slot;
    img.dataset.kind = "thumbnail";
    img.style.display = "none";
    img.style.position = "absolute";
    img.style.pointerEvents = "none";
    img.style.zIndex = "2";
    img.style.objectFit = "cover";
    img.referrerPolicy = "strict-origin-when-cross-origin";
    return img;
  }

  private positionSlotMounts(): void {
    if (!this.iframe) return;
    const s = this.scale;
    const slots = this.slotRects;
    const ox = this.stageOffsetX;
    const oy = this.stageOffsetY;
    const screen = this.currentScreen;
    const item = this.currentItem;
    this.slotMounts.forEach((mount) => {
      const isNext = mount.slot === "next";
      if (!screen) {
        mount.el.style.display = "none";
        return;
      }
      if (isNext) {
        if (!screen.hasNextVideoSlot || !item?.next?.video?.url) {
          mount.el.style.display = "none";
          return;
        }
      } else if (!screen.hasVideoSlot || !item?.video?.url) {
        mount.el.style.display = "none";
        return;
      }
      const slot = isNext ? slots.next : slots.main;
      if (!slot || slot.width <= 0 || slot.height <= 0) {
        mount.el.style.display = "none";
        return;
      }
      const w = slot.width * s;
      const h = slot.height * s;
      mount.el.style.display = "block";
      mount.el.style.left = `${ox + slot.left * s}px`;
      mount.el.style.top = `${oy + slot.top * s}px`;
      mount.el.style.width = `${w}px`;
      mount.el.style.height = `${h}px`;
      if (mount.kind === "video") {
        (mount.el as HTMLVideoElement).style.objectFit = "cover";
      }
      if (mount.kind === "youtube") {
        this.applyYtCover(mount.el as HTMLDivElement, Math.round(slot.width), Math.round(slot.height));
      }
    });
  }
}