import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deviceLastSeenAlert,
  deviceLastSeenLabel,
  deviceLastSeenPresent,
} from "../dist/admin-logic/device-last-seen.js";

const NOW = new Date("2026-03-20T12:00:00+09:00");

describe("deviceLastSeenLabel", () => {
  it("null → 접속 기록 없음", () => {
    assert.equal(deviceLastSeenLabel(null, NOW), "접속 기록 없음");
  });

  it("under 1 minute → 방금 전", () => {
    assert.equal(deviceLastSeenLabel("2026-03-20T11:59:30+09:00", NOW), "방금 전");
  });

  it("minutes, hours, days", () => {
    assert.equal(deviceLastSeenLabel("2026-03-20T11:45:00+09:00", NOW), "15분 전");
    assert.equal(deviceLastSeenLabel("2026-03-20T09:00:00+09:00", NOW), "3시간 전");
    assert.equal(deviceLastSeenLabel("2026-03-18T12:00:00+09:00", NOW), "2일 전");
  });
});

describe("deviceLastSeenAlert", () => {
  it("null or stale → alert", () => {
    assert.equal(deviceLastSeenAlert(null, NOW), true);
    assert.equal(deviceLastSeenAlert("2026-03-20T11:40:00+09:00", NOW), true);
  });

  it("recent → no alert", () => {
    assert.equal(deviceLastSeenAlert("2026-03-20T11:55:00+09:00", NOW), false);
  });
});

describe("deviceLastSeenPresent", () => {
  it("bundles fields", () => {
    const ts = "2026-03-20T11:59:45+09:00";
    const present = deviceLastSeenPresent(ts, NOW);
    assert.equal(present.lastSeenAt, ts);
    assert.equal(present.seenLabel, "방금 전");
    assert.equal(present.seenAlert, false);
  });
});