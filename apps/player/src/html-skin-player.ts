import {
  buildHtmlSkinSrcdoc,
  resolveStepScreen,
  type HtmlSkinScreensMap,
  type PlayItem,
  type PublishedSnapshot,
  type SkinScreenSnapshot,
} from "@mvn/shared";

type HtmlSkinProgram = PublishedSnapshot & {
  playItems: PlayItem[];
  publishedVersion: number;
  publishedAt: string;
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
  private videoEls: HTMLVideoElement[] = [];
  private timer: number | null = null;
  private index = 0;
  private program: HtmlSkinProgram | null = null;
  private callbacks: HtmlSkinPlayerCallbacks;
  private scale = 1;

  constructor(wrap: HTMLElement, callbacks: HtmlSkinPlayerCallbacks) {
    this.wrap = wrap;
    this.callbacks = callbacks;
    window.addEventListener("message", this.onMessage);
    window.addEventListener("resize", this.relayout);
  }

  destroy(): void {
    this.stopTimer();
    this.clearVideos();
    if (this.iframe) this.iframe.remove();
    this.iframe = null;
    window.removeEventListener("message", this.onMessage);
    window.removeEventListener("resize", this.relayout);
  }

  start(program: HtmlSkinProgram): void {
    this.program = program;
    this.index = 0;
    this.wrap.innerHTML = "";
    this.wrap.style.position = "relative";
    this.wrap.style.width = "100%";
    this.wrap.style.aspectRatio = "16 / 9";
    this.wrap.style.overflow = "hidden";
    this.iframe = document.createElement("iframe");
    this.iframe.setAttribute("sandbox", "allow-scripts");
    this.iframe.style.position = "absolute";
    this.iframe.style.left = "0";
    this.iframe.style.top = "0";
    this.iframe.style.width = "1920px";
    this.iframe.style.height = "1080px";
    this.iframe.style.border = "0";
    this.iframe.style.background = "transparent";
    this.iframe.style.transformOrigin = "top left";
    this.wrap.appendChild(this.iframe);
    this.relayout();
    this.showStep(0);
  }

  private relayout = (): void => {
    if (!this.iframe || !this.wrap.clientWidth) return;
    this.scale = this.wrap.clientWidth / 1920;
    this.iframe.style.transform = `scale(${this.scale})`;
    this.wrap.style.height = `${1080 * this.scale}px`;
    this.positionVideos();
  };

  private screensMap(): HtmlSkinScreensMap {
    return this.program?.skin?.screens ?? {};
  }

  private orderedScreens(): SkinScreenSnapshot[] {
    const map = this.screensMap();
    return Object.values(map);
  }

  private onMessage = (ev: MessageEvent): void => {
    if (ev.data?.type === "mvn:html-skin-slot" && this.iframe) {
      this.positionVideos();
    }
  };

  private stopTimer(): void {
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private clearVideos(): void {
    this.videoEls.forEach((v) => v.remove());
    this.videoEls = [];
  }

  private showStep(playIndex: number): void {
    if (!this.program || !this.iframe) return;
  const items = this.program.playItems;
    if (playIndex >= items.length) {
      this.callbacks.onDone();
      return;
    }
    this.index = playIndex;
    this.stopTimer();
    this.clearVideos();
    const item = items[playIndex];
    const screen = resolveStepScreen(item.screenId, this.screensMap(), this.orderedScreens()) ?? {
      id: "fallback",
      title: "fallback",
      html: FALLBACK_HTML,
      css: FALLBACK_CSS,
      hasVideoSlot: true,
      hasNextVideoSlot: false,
      titleOnly: false,
      version: 1,
    };
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
    const tokens = this.buildTokens(item, remaining);
    this.iframe.onload = () => {
      this.iframe?.contentWindow?.postMessage({ type: "mvn:html-skin-tokens", tokens }, "*");
      this.mountVideos(item, screen);
      let left = remaining;
      this.timer = window.setInterval(() => {
        left -= 1;
        if (left <= 0) {
          this.stopTimer();
          this.showStep(playIndex + 1);
          return;
        }
        const t = this.buildTokens(item, left);
        this.iframe?.contentWindow?.postMessage({ type: "mvn:html-skin-tokens", tokens: t }, "*");
      }, 1000);
    };
  }

  private buildTokens(item: PlayItem, remainingSec: number): Record<string, string | number | boolean> {
    const prog = this.program!;
    const next = item.next;
    return {
      label: item.label,
      remainingSec,
      totalSec: item.durationSec,
      "next.label": next?.label ?? "",
      "next.afterRest": next?.afterRest ?? false,
      round: 1,
      roundTotal: 1,
      stepIndex: item.index + 1,
      stepTotal: prog.playItems.length,
      "program.name": prog.name,
      logoUrl: String(prog.skin.options.logoUrl ?? ""),
      pointColor: prog.skin.options.pointColor ?? "#C8F31D",
    };
  }

  private mountVideos(item: PlayItem, screen: SkinScreenSnapshot): void {
    if (!screen.hasVideoSlot || !item.video?.url) return;
    const main = this.createSlotVideo(item.video.url, "main");
    this.wrap.appendChild(main);
    this.videoEls.push(main);
    if (screen.hasNextVideoSlot && item.next?.video?.url) {
      const next = this.createSlotVideo(item.next.video.url, "next");
      this.wrap.appendChild(next);
      this.videoEls.push(next);
    }
    this.positionVideos();
  }

  /** HTML 스킨 슬롯 오버레이 — controls 없음, muted autoplay playsinline loop */
  private createSlotVideo(url: string, slot: "main" | "next"): HTMLVideoElement {
    const video = document.createElement("video");
    video.src = url;
    video.controls = false;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.loop = true;
    video.dataset.slot = slot;
    return video;
  }

  private positionVideos(): void {
    if (!this.iframe) return;
    const s = this.scale;
    const slots = this.querySlotRects();
    this.videoEls.forEach((video) => {
      const slot = video.dataset.slot === "next" ? slots.next : slots.main;
      if (!slot) {
        video.style.display = "none";
        return;
      }
      video.style.display = "block";
      video.style.position = "absolute";
      video.style.left = `${slot.left * s}px`;
      video.style.top = `${slot.top * s}px`;
      video.style.width = `${slot.width * s}px`;
      video.style.height = `${slot.height * s}px`;
      video.style.objectFit = "cover";
      video.style.zIndex = "1";
      video.style.pointerEvents = "none";
    });
    if (this.iframe) this.iframe.style.zIndex = "2";
  }

  private querySlotRects(): { main?: DOMRect; next?: DOMRect } {
    const doc = this.iframe?.contentDocument;
    if (!doc) return {};
    const mainEl = doc.querySelector("[data-mvn-video]");
    const nextEl = doc.querySelector("[data-mvn-next-video]");
    return {
      main: mainEl?.getBoundingClientRect(),
      next: nextEl?.getBoundingClientRect(),
    };
  }
}