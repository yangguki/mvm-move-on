import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateHtmlProgramSteps } from "../dist/index.js";
import { loadIptPowerBellManifest } from "../ipt-power-bell-screens/load.mjs";
import {
  IPT_POWER_BELL_SAMPLE_SCREEN_COUNTS,
  IPT_POWER_BELL_SAMPLE_STEP_COUNT,
  IPT_POWER_BELL_SAMPLE_TOTAL_DURATION_SEC,
  buildIptPowerBellSampleSteps,
  totalDurationSec,
} from "../ipt-power-bell-screens/sample-program-steps.mjs";

describe("ipt-power-bell sample program steps", () => {
  const manifest = loadIptPowerBellManifest();
  const screenIds = Object.fromEntries(manifest.screens.map((s) => [s.slug, s.slug]));
  const videoId = "video-ready-1";
  const steps = buildIptPowerBellSampleSteps({ screenIds, videoId });

  it("builds exactly 74 expanded steps", () => {
    assert.equal(steps.length, IPT_POWER_BELL_SAMPLE_STEP_COUNT);
    assert.equal(steps.length, 74);
  });

  it("matches per-screen counts", () => {
    const counts = Object.fromEntries(manifest.screens.map((s) => [s.slug, 0]));
    for (const step of steps) {
      counts[step.screenId] = (counts[step.screenId] ?? 0) + 1;
    }
    assert.deepEqual(counts, IPT_POWER_BELL_SAMPLE_SCREEN_COUNTS);
  });

  it("matches total duration", () => {
    assert.equal(totalDurationSec(steps), IPT_POWER_BELL_SAMPLE_TOTAL_DURATION_SEC);
    assert.equal(totalDurationSec(steps), 2015);
  });

  it("uses exercise names / warm-up / cool-down labels from sheet", () => {
    const labels = steps.map((s) => s.label);
    for (let i = 1; i <= 8; i += 1) assert.ok(labels.includes(`웜업 ${i}`));
    for (let i = 1; i <= 6; i += 1) assert.ok(labels.includes(`쿨다운 ${i}`));
    const exerciseLabels = steps.filter((s) => s.screenId === "exercise").map((s) => s.label);
    for (const name of ["1번 운동 동작", "2번 운동 동작", "3번 운동 동작", "4번 운동 동작"]) {
      assert.equal(exerciseLabels.filter((l) => l === name).length, 6); // 2 blocks × 3 sets
    }
    const setTexts = steps.filter((s) => s.screenId === "exercise").map((s) => s.text);
    assert.equal(setTexts.filter((t) => t === "set=1/3").length, 8);
    assert.equal(setTexts.filter((t) => t === "set=2/3").length, 8);
    assert.equal(setTexts.filter((t) => t === "set=3/3").length, 8);
  });

  it("passes validateHtmlProgramSteps with manifest slot flags", () => {
    const screens = manifest.screens.map((s) => ({
      id: s.slug,
      hasVideoSlot: s.hasVideoSlot,
      hasNextVideoSlot: s.hasNextVideoSlot,
      titleOnly: s.titleOnly,
    }));
    assert.doesNotThrow(() => validateHtmlProgramSteps(steps, screens));
  });

  it("puts videoId only on video-slot screens", () => {
    const bySlug = Object.fromEntries(manifest.screens.map((s) => [s.slug, s]));
    for (const step of steps) {
      const screen = bySlug[step.screenId];
      if (screen.hasVideoSlot) assert.equal(step.videoId, videoId);
      else assert.equal(step.videoId, undefined);
    }
  });
});
