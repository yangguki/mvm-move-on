type YtPlayerState = {
  ENDED: number;
  PLAYING: number;
  PAUSED: number;
};

type YtPlayer = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getIframe?: () => HTMLIFrameElement;
};

type YtPlayerCtor = new (
  el: HTMLElement,
  opts: {
    videoId: string;
    host?: string;
    width?: number | string;
    height?: number | string;
    playerVars?: Record<string, number | string>;
    events?: {
      onReady?: (event: { target: YtPlayer }) => void;
      onStateChange?: (event: { data: number; target: YtPlayer }) => void;
      onError?: () => void;
    };
  },
) => YtPlayer;

export type YouTubeIframeApi = {
  Player: YtPlayerCtor;
  PlayerState: YtPlayerState;
};

declare global {
  interface Window {
    YT?: YouTubeIframeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<YouTubeIframeApi> | null = null;

const API_SCRIPT = "https://www.youtube.com/iframe_api";
const API_TIMEOUT_MS = 12_000;

/** Loads https://www.youtube.com/iframe_api once per page. */
export function loadYouTubeIframeApi(): Promise<YouTubeIframeApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiReady) return apiReady;
  apiReady = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube IFrame API missing YT.Player"));
    };
    const existing = document.querySelector(`script[src="${API_SCRIPT}"]`);
    if (existing && window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    if (existing) {
      const poll = window.setInterval(() => {
        if (window.YT?.Player) {
          window.clearInterval(poll);
          resolve(window.YT);
        }
      }, 50);
      window.setTimeout(() => {
        window.clearInterval(poll);
        reject(new Error("YouTube IFrame API timeout"));
      }, API_TIMEOUT_MS);
      return;
    }
    const tag = document.createElement("script");
    tag.src = API_SCRIPT;
    tag.async = true;
    tag.onerror = () => reject(new Error("YouTube IFrame API load failed"));
    document.head.appendChild(tag);
  });
  return apiReady;
}

export function youtubePlayerVars(): Record<string, number | string> {
  return {
    autoplay: 1,
    mute: 1,
    playsinline: 1,
    controls: 0,
    rel: 0,
    modestbranding: 1,
    disablekb: 1,
    iv_load_policy: 3,
    fs: 0,
    cc_load_policy: 0,
  };
}
