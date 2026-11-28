import { parseYouTubeVideoId } from "./youtube";
import type { PlayItem, Video } from "./program";

export const MP4_PRELOAD_MAX_WAIT_MS = 4000;

export type Mp4PreloadTarget = { id: string; url: string };

function addMp4Target(
  video: Video | undefined,
  seen: Set<string>,
  out: Mp4PreloadTarget[],
): void {
  if (!video?.id?.trim() || !video.url?.trim()) return;
  if (parseYouTubeVideoId(video.url)) return;
  const id = video.id.trim();
  if (seen.has(id)) return;
  seen.add(id);
  out.push({ id, url: video.url.trim() });
}

/** Unique mp4 targets by video.id, first-appearance order (main + next slots). */
export function collectMp4PreloadTargets(playItems: PlayItem[]): Mp4PreloadTarget[] {
  const seen = new Set<string>();
  const out: Mp4PreloadTarget[] = [];
  for (const item of playItems) {
    addMp4Target(item.video, seen, out);
    addMp4Target(item.next?.video, seen, out);
  }
  return out;
}

export type MediaPool<T> = {
  /** Pre-register a preloaded element (not marked in-use). */
  register(id: string, el: T): void;
  /**
   * Returns an idle element for `id`, or creates a clone via `create` when every
   * element for that id is already acquired (same id in main + next slot, etc.).
   */
  acquire(id: string): T;
  release(el: T): void;
  has(id: string): boolean;
  size(): number;
  disposeAll(): void;
};

export function createMediaPool<T>(options: {
  create: (id: string) => T;
  dispose: (el: T) => void;
}): MediaPool<T> {
  const byId = new Map<string, T[]>();
  const inUse = new Set<T>();

  const listFor = (id: string): T[] => {
    let list = byId.get(id);
    if (!list) {
      list = [];
      byId.set(id, list);
    }
    return list;
  };

  return {
    register(id, el) {
      listFor(id).push(el);
    },
    acquire(id) {
      const list = byId.get(id) ?? [];
      for (const el of list) {
        if (!inUse.has(el)) {
          inUse.add(el);
          return el;
        }
      }
      const el = options.create(id);
      listFor(id).push(el);
      inUse.add(el);
      return el;
    },
    release(el) {
      inUse.delete(el);
    },
    has(id) {
      return (byId.get(id)?.length ?? 0) > 0;
    },
    size() {
      let n = 0;
      for (const list of byId.values()) n += list.length;
      return n;
    },
    disposeAll() {
      for (const list of byId.values()) {
        for (const el of list) options.dispose(el);
      }
      byId.clear();
      inUse.clear();
    },
  };
}

export type PreloadProgress = {
  markSettled(id: string): void;
  readonly settled: number;
  readonly total: number;
  readonly isDone: boolean;
};

export function createPreloadProgress(
  total: number,
  onChange?: (settled: number, total: number) => void,
): PreloadProgress {
  const marked = new Set<string>();
  let settled = 0;

  const bump = (): void => {
    onChange?.(settled, total);
  };

  return {
    markSettled(id) {
      if (marked.has(id)) return;
      marked.add(id);
      settled += 1;
      bump();
    },
    get settled() {
      return settled;
    },
    get total() {
      return total;
    },
    get isDone() {
      return total <= 0 || settled >= total;
    },
  };
}