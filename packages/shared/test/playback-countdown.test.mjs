import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLAYBACK_COUNTDOWN_FALLBACK_MS,
  createPlaybackCountdownController,
} from "../dist/playback-countdown.js";

function fakeTimers() {
  let now = 0;
  const tasks = [];
  const schedule = (fn, ms) => {
    const runAt = now + ms;
    const id = { runAt, fn, cancelled: false };
    tasks.push(id);
    tasks.sort((a, b) => a.runAt - b.runAt);
    return id;
  };
  const cancel = (id) => {
    if (id && typeof id === "object") id.cancelled = true;
  };
  const tick = (ms) => {
    now += ms;
    while (tasks.length && tasks[0].runAt <= now) {
      const t = tasks.shift();
      if (!t.cancelled) t.fn();
    }
  };
  return { schedule, cancel, tick };
}

describe("playback countdown controller", () => {
  it("waitForPlayback false starts immediately once", () => {
    const starts = [];
    const c = createPlaybackCountdownController({
      onStart: (r) => starts.push(r),
    });
    c.arm({ waitForPlayback: false });
    assert.deepEqual(starts, ["immediate"]);
    c.arm({ waitForPlayback: false });
    assert.deepEqual(starts, ["immediate"]);
  });

  it("first notify starts once and cancels fallback", () => {
    const { schedule, cancel, tick } = fakeTimers();
    const starts = [];
    const c = createPlaybackCountdownController({
      fallbackMs: 5000,
      schedule,
      cancel,
      onStart: (r) => starts.push(r),
    });
    c.arm({ waitForPlayback: true });
    c.notifyPlaybackStarted();
    assert.deepEqual(starts, ["first-play"]);
    tick(PLAYBACK_COUNTDOWN_FALLBACK_MS + 1000);
    assert.deepEqual(starts, ["first-play"]);
  });

  it("second notify is a no-op", () => {
    const starts = [];
    const c = createPlaybackCountdownController({
      onStart: (r) => starts.push(r),
    });
    c.arm({ waitForPlayback: true });
    c.notifyPlaybackStarted();
    c.notifyPlaybackStarted();
    assert.deepEqual(starts, ["first-play"]);
  });

  it("fallback starts after fallbackMs if notify never comes; later notify ignored", () => {
    const { schedule, cancel, tick } = fakeTimers();
    const starts = [];
    const c = createPlaybackCountdownController({
      fallbackMs: 3000,
      schedule,
      cancel,
      onStart: (r) => starts.push(r),
    });
    c.arm({ waitForPlayback: true });
    tick(2999);
    assert.deepEqual(starts, []);
    tick(1);
    assert.deepEqual(starts, ["fallback"]);
    c.notifyPlaybackStarted();
    assert.deepEqual(starts, ["fallback"]);
  });

  it("reset then re-arm clears first-play guard and old fallback", () => {
    const { schedule, cancel, tick } = fakeTimers();
    const starts = [];
    const c = createPlaybackCountdownController({
      fallbackMs: 5000,
      schedule,
      cancel,
      onStart: (r) => starts.push(r),
    });
    c.arm({ waitForPlayback: true });
    c.reset();
    c.arm({ waitForPlayback: true });
    c.notifyPlaybackStarted();
    assert.deepEqual(starts, ["first-play"]);
    tick(10000);
    assert.deepEqual(starts, ["first-play"]);
  });

  it("dispose cancels pending fallback", () => {
    const { schedule, cancel, tick } = fakeTimers();
    const starts = [];
    const c = createPlaybackCountdownController({
      fallbackMs: 5000,
      schedule,
      cancel,
      onStart: (r) => starts.push(r),
    });
    c.arm({ waitForPlayback: true });
    c.dispose();
    tick(10000);
    assert.deepEqual(starts, []);
    assert.equal(c.hasStarted(), false);
  });

  it("hasStarted reflects start state", () => {
    const c = createPlaybackCountdownController({ onStart: () => {} });
    assert.equal(c.hasStarted(), false);
    c.arm({ waitForPlayback: false });
    assert.equal(c.hasStarted(), true);
  });
});