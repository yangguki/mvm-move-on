import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampRepeatCount, computeVideoStepDurationSec } from "../dist/index.js";

/**
 * 빌더 저장 payload의 exercise repeatCount 규칙 (builder-screen `builderStepToShared`와 동일).
 */
function builderStepToShared(step, index, opts) {
  const screen = step.screenId ? opts.screens.find((s) => s.id === step.screenId) : undefined;
  const video = step.videoId ? opts.videos.find((v) => v.id === step.videoId) : undefined;
  const sharedType = step.kind === "countdown" ? "guide" : step.kind;
  const hasVideoSlot = opts.isHtmlSkin ? !!screen?.hasVideoSlot : step.kind === "exercise";
  let durationSec = Math.max(1, Math.floor(step.seconds));
  let repeatCount;
  if (hasVideoSlot && video && video.durationSec > 0) {
    repeatCount =
      step.repeatCount != null && Number.isFinite(step.repeatCount) && step.repeatCount > 0
        ? clampRepeatCount(step.repeatCount)
        : clampRepeatCount(Math.round(step.seconds / video.durationSec));
    durationSec = computeVideoStepDurationSec(repeatCount, video.durationSec);
  } else if (sharedType === "exercise" && step.repeatCount != null) {
    repeatCount = clampRepeatCount(step.repeatCount);
  }
  const out = {
    id: `step-${index}`,
    type: sharedType,
    durationSec,
    videoId: step.videoId ?? undefined,
    screenId: step.screenId ?? undefined,
  };
  if (sharedType === "exercise" && repeatCount != null) out.repeatCount = repeatCount;
  return out;
}

describe("builderStepToShared repeatCount", () => {
  it("영상 목록에 없어도 exercise repeatCount는 payload에 남는다", () => {
    const out = builderStepToShared(
      {
        kind: "exercise",
        seconds: 12,
        repeatCount: 3,
        videoId: "v1",
        screenId: "main",
      },
      0,
      {
        isHtmlSkin: true,
        screens: [{ id: "main", hasVideoSlot: true }],
        videos: [],
      },
    );
    assert.equal(out.repeatCount, 3);
    assert.equal(out.durationSec, 12);
  });

  it("html 영상 슬롯 + 영상이 있으면 repeatCount·durationSec를 맞춘다", () => {
    const out = builderStepToShared(
      {
        kind: "exercise",
        seconds: 12,
        repeatCount: 3,
        videoId: "v1",
        screenId: "main",
      },
      0,
      {
        isHtmlSkin: true,
        screens: [{ id: "main", hasVideoSlot: true }],
        videos: [{ id: "v1", durationSec: 4 }],
      },
    );
    assert.equal(out.repeatCount, 3);
    assert.equal(out.durationSec, 12);
  });
});