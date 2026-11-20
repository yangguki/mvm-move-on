import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampRepeatCount,
  clampStepDurationSec,
  computeVideoStepDurationSec,
  inferVideoStepRepeatCount,
  resolveDefaultVideoStepRepeatCount,
  resolveStepDurationOnScreenChange,
  resolveVideoStepDurationSec,
  resolveVideoStepTimingOnScreenChange,
  STEP_DURATION_SEC_MAX,
  STEP_DURATION_SEC_MIN,
  STEP_REPEAT_COUNT_MAX,
  STEP_REPEAT_COUNT_MIN,
} from "../dist/step-duration.js";

describe("video step repeat count", () => {
  it("default repeat: round(screenDefault / videoLength), min 1", () => {
    assert.equal(resolveDefaultVideoStepRepeatCount({ screenDefaultDurationSec: 12, videoDurationSec: 4 }), 3);
    assert.equal(resolveDefaultVideoStepRepeatCount({ videoDurationSec: 4 }), 1);
    assert.equal(resolveDefaultVideoStepRepeatCount({ screenDefaultDurationSec: 3, videoDurationSec: 4 }), 1);
  });

  it("infers repeat from duration when repeatCount missing", () => {
    assert.equal(inferVideoStepRepeatCount({ durationSec: 12, videoDurationSec: 4 }), 3);
    assert.equal(inferVideoStepRepeatCount({ durationSec: 5, videoDurationSec: 4 }), 1);
    assert.equal(inferVideoStepRepeatCount({ repeatCount: 5, durationSec: 12, videoDurationSec: 4 }), 5);
  });

  it("durationSec = video length × repeat", () => {
    assert.equal(computeVideoStepDurationSec(3, 4), 12);
    assert.equal(computeVideoStepDurationSec(99, 4), 396);
    assert.equal(computeVideoStepDurationSec(100, 40), STEP_DURATION_SEC_MAX);
  });

  it("clamps repeat to 1..99", () => {
    assert.equal(clampRepeatCount(0), STEP_REPEAT_COUNT_MIN);
    assert.equal(clampRepeatCount(500), STEP_REPEAT_COUNT_MAX);
  });
});

describe("resolveVideoStepDurationSec (no video length fallback)", () => {
  it("screen default > video length > fallback", () => {
    assert.equal(
      resolveVideoStepDurationSec({
        screenDefaultDurationSec: 30,
        videoDurationSec: 4,
      }),
      30,
    );
    assert.equal(resolveVideoStepDurationSec({ videoDurationSec: 4 }), 4);
    assert.equal(resolveVideoStepDurationSec({}), 45);
  });
});

describe("resolveVideoStepTimingOnScreenChange", () => {
  it("video slot with known length uses repeat on screen pick", () => {
    assert.deepEqual(
      resolveVideoStepTimingOnScreenChange({
        reason: "user_picked_screen",
        currentDurationSec: 99,
        screenDefaultDurationSec: 12,
        hasVideoSlot: true,
        videoDurationSec: 4,
      }),
      { repeatCount: 3, durationSec: 12 },
    );
  });

  it("respects user edit on auto assign", () => {
    assert.deepEqual(
      resolveVideoStepTimingOnScreenChange({
        reason: "auto_assign_screen",
        currentDurationSec: 20,
        currentRepeatCount: 5,
        durationUserEdited: true,
        screenDefaultDurationSec: 12,
        hasVideoSlot: true,
        videoDurationSec: 4,
      }),
      { repeatCount: 5, durationSec: 20 },
    );
  });

  it("non-video slot uses direct duration", () => {
    assert.equal(
      resolveStepDurationOnScreenChange({
        reason: "user_picked_screen",
        currentDurationSec: 10,
        screenDefaultDurationSec: 5,
        hasVideoSlot: false,
      }),
      5,
    );
  });
});

describe("clampStepDurationSec", () => {
  it("clamps to 1..3600", () => {
    assert.equal(clampStepDurationSec(0), STEP_DURATION_SEC_MIN);
    assert.equal(clampStepDurationSec(99999), STEP_DURATION_SEC_MAX);
  });
});