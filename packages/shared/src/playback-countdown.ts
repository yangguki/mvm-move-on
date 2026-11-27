export const PLAYBACK_COUNTDOWN_FALLBACK_MS = 5000;

export type PlaybackCountdownStartReason = "immediate" | "first-play" | "fallback";

export type PlaybackCountdownController = {
  arm(options: { waitForPlayback: boolean }): void;
  notifyPlaybackStarted(): void;
  reset(): void;
  dispose(): void;
  hasStarted(): boolean;
};

export type CreatePlaybackCountdownControllerOptions = {
  fallbackMs?: number;
  onStart: (reason: PlaybackCountdownStartReason) => void;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (id: unknown) => void;
};

const timerHost = globalThis as unknown as {
  setTimeout: (handler: () => void, timeout?: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export function createPlaybackCountdownController(
  options: CreatePlaybackCountdownControllerOptions,
): PlaybackCountdownController {
  const fallbackMs = options.fallbackMs ?? PLAYBACK_COUNTDOWN_FALLBACK_MS;
  const schedule = options.schedule ?? ((fn, ms) => timerHost.setTimeout(fn, ms));
  const cancel = options.cancel ?? ((id) => timerHost.clearTimeout(id));
  const { onStart } = options;

  let started = false;
  let armed = false;
  let fallbackId: unknown = null;

  const clearFallback = (): void => {
    if (fallbackId != null) {
      cancel(fallbackId);
      fallbackId = null;
    }
  };

  const startOnce = (reason: PlaybackCountdownStartReason): void => {
    if (started) return;
    started = true;
    clearFallback();
    onStart(reason);
  };

  const reset = (): void => {
    clearFallback();
    started = false;
    armed = false;
  };

  return {
    arm({ waitForPlayback }) {
      armed = true;
      if (!waitForPlayback) {
        startOnce("immediate");
        return;
      }
      fallbackId = schedule(() => startOnce("fallback"), fallbackMs);
    },
    notifyPlaybackStarted() {
      if (!armed || started) return;
      startOnce("first-play");
    },
    reset,
    dispose: reset,
    hasStarted() {
      return started;
    },
  };
}