import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  collectMp4PreloadTargets,
  createMediaPool,
  createPreloadProgress,
  MP4_PRELOAD_MAX_WAIT_MS,
} from "../dist/video-preload.js";

describe("collectMp4PreloadTargets", () => {
  const mp4 = (id, url) => ({ id, name: id, url, durationSec: 1, thumbnailUrl: "", width: 1, height: 1 });

  it("dedupes by id keeping first url", () => {
    const items = [
      { index: 0, stepId: "a", type: "exercise", durationSec: 10, label: "A", video: mp4("v1", "/a.mp4") },
      { index: 1, stepId: "b", type: "exercise", durationSec: 10, label: "B", video: mp4("v1", "/b.mp4") },
    ];
    const targets = collectMp4PreloadTargets(items);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].url, "/a.mp4");
  });

  it("keeps two entries for same url different ids", () => {
    const items = [
      { index: 0, stepId: "a", type: "exercise", durationSec: 10, label: "A", video: mp4("v1", "/x.mp4") },
      { index: 1, stepId: "b", type: "exercise", durationSec: 10, label: "B", video: mp4("v2", "/x.mp4") },
    ];
    const targets = collectMp4PreloadTargets(items);
    assert.equal(targets.length, 2);
    assert.deepEqual(
      targets.map((t) => t.id),
      ["v1", "v2"],
    );
  });

  it("excludes YouTube urls", () => {
    const items = [
      {
        index: 0,
        stepId: "a",
        type: "exercise",
        durationSec: 10,
        label: "A",
        video: mp4("yt", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      },
    ];
    assert.equal(collectMp4PreloadTargets(items).length, 0);
  });

  it("includes next video and preserves order", () => {
    const items = [
      {
        index: 0,
        stepId: "a",
        type: "exercise",
        durationSec: 10,
        label: "A",
        video: mp4("main", "/m.mp4"),
        next: { label: "n", afterRest: false, video: mp4("next", "/n.mp4") },
      },
      { index: 1, stepId: "b", type: "exercise", durationSec: 10, label: "B", video: mp4("step2", "/s.mp4") },
    ];
    const targets = collectMp4PreloadTargets(items);
    assert.deepEqual(
      targets.map((t) => t.id),
      ["main", "next", "step2"],
    );
  });

  it("skips blank id or url", () => {
    const items = [
      { index: 0, stepId: "a", type: "exercise", durationSec: 10, label: "A", video: { ...mp4("v", "/a.mp4"), id: "  " } },
      { index: 1, stepId: "b", type: "exercise", durationSec: 10, label: "B", video: mp4("v2", "  ") },
    ];
    assert.equal(collectMp4PreloadTargets(items).length, 0);
  });
});

describe("createMediaPool", () => {
  it("acquire/release and clone-when-busy", () => {
    let created = 0;
    const pool = createMediaPool({
      create: (id) => {
        created += 1;
        return { id, n: created };
      },
      dispose: () => {},
    });
    pool.register("a", { id: "a", n: 0 });
    const first = pool.acquire("a");
    assert.equal(first.n, 0);
    const second = pool.acquire("a");
    assert.equal(second.n, 1);
    assert.notEqual(first, second);
    pool.release(first);
    pool.release(second);
    const again = pool.acquire("a");
    assert.equal(again.n, 0);
  });

  it("disposeAll clears size", () => {
    let disposed = 0;
    const pool = createMediaPool({
      create: () => ({ id: "x" }),
      dispose: () => {
        disposed += 1;
      },
    });
    pool.register("a", { id: "a" });
    pool.acquire("a");
    assert.equal(pool.size(), 1);
    pool.disposeAll();
    assert.equal(pool.size(), 0);
    assert.equal(disposed, 1);
  });

  it("has reflects registration", () => {
    const pool = createMediaPool({
      create: () => ({}),
      dispose: () => {},
    });
    assert.equal(pool.has("missing"), false);
    pool.register("a", {});
    assert.equal(pool.has("a"), true);
  });
});

describe("createPreloadProgress", () => {
  it("idempotent markSettled and isDone", () => {
    const changes = [];
    const p = createPreloadProgress(2, (n, m) => changes.push([n, m]));
    p.markSettled("a");
    p.markSettled("a");
    p.markSettled("b");
    assert.equal(p.settled, 2);
    assert.equal(p.isDone, true);
    assert.deepEqual(changes, [[1, 2], [2, 2]]);
  });

  it("zero total is immediately done", () => {
    const p = createPreloadProgress(0);
    assert.equal(p.isDone, true);
  });
});

describe("MP4_PRELOAD_MAX_WAIT_MS", () => {
  it("is 4000", () => {
    assert.equal(MP4_PRELOAD_MAX_WAIT_MS, 4000);
  });
});