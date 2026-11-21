"use client";

import { parseYouTubeVideoId } from "@mvn/shared";

type YtPlayer = {
  destroy: () => void;
  getDuration: () => number;
};

type YtPlayerCtor = new (
  el: HTMLElement,
  opts: {
    videoId: string;
    width?: number;
    height?: number;
    playerVars?: Record<string, number | string>;
    events?: {
      onReady?: (event: { target: YtPlayer }) => void;
      onError?: () => void;
    };
  },
) => YtPlayer;

declare global {
  interface Window {
    YT?: { Player: YtPlayerCtor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve();
  if (apiReady) return apiReady;
  apiReady = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existing && window.YT?.Player) {
      resolve();
      return;
    }
    if (existing) {
      const poll = window.setInterval(() => {
        if (window.YT?.Player) {
          window.clearInterval(poll);
          resolve();
        }
      }, 50);
      window.setTimeout(() => {
        window.clearInterval(poll);
        reject(new Error("YouTube IFrame API timeout"));
      }, 12_000);
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => reject(new Error("YouTube IFrame API load failed"));
    document.head.appendChild(tag);
  });
  return apiReady;
}

/** Hidden IFrame API player — no API key; returns null on timeout/error. */
export async function fetchYouTubeDurationSec(url: string): Promise<number | null> {
  const id = parseYouTubeVideoId(url);
  if (!id) return null;
  await loadYouTubeIframeApi();
  const YT = window.YT;
  if (!YT?.Player) return null;

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    document.body.appendChild(host);

    let player: YtPlayer | null = null;
    const finish = (sec: number | null) => {
      window.clearTimeout(timer);
      try {
        player?.destroy();
      } catch {
        /* ignore */
      }
      host.remove();
      resolve(sec);
    };

    const timer = window.setTimeout(() => finish(null), 12_000);

    try {
      player = new YT.Player(host, {
        videoId: id,
        width: 1,
        height: 1,
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onReady: (event) => {
            const raw = event.target.getDuration();
            const sec = Number.isFinite(raw) && raw > 0 ? Math.max(1, Math.ceil(raw)) : null;
            finish(sec);
          },
          onError: () => finish(null),
        },
      });
    } catch {
      finish(null);
    }
  });
}