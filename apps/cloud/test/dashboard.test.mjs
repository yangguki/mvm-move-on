import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminDashboardResponse } from "../../../packages/shared/src/admin-logic/catalog-aggregate.ts";
import { matchRoute } from "../src/router-match.ts";

test("dashboard route is registered", () => {
  const route = matchRoute("GET", "/api/admin/v1/dashboard");
  assert.equal(route?.name, "dashboard");
  assert.equal(route?.auth, "admin");
});

test("buildAdminDashboardResponse matches Nest shape", () => {
  const devices = [
    {
      code: "tv-01",
      name: "1번 TV",
      status: "ok",
      playing: "Morning Flow",
      offline: false,
      seenLabel: "방금",
      store: { name: "강남점" },
    },
    {
      code: "tv-02",
      name: "2번 TV",
      status: "err",
      playing: null,
      offline: true,
      seenLabel: "2시간 전",
      store: { name: "강남점" },
    },
  ];
  const stores = [
    { devices: [{ offline: false }, { offline: true }] },
    { devices: [{ offline: false }] },
  ];
  const body = buildAdminDashboardResponse(devices, stores, new Date("2026-03-20T12:00:00+09:00"));
  assert.equal(body.programName, "Morning Flow");
  assert.deepEqual(body.playing, { count: 1, total: 2 });
  assert.deepEqual(body.online, { count: 1, total: 2 });
  assert.deepEqual(body.stores, { count: 2, attention: 1 });
  assert.equal(body.offline.length, 1);
  assert.equal(body.offline[0]?.code, "tv-02");
  assert.match(body.dateLabel, /3월/);
});