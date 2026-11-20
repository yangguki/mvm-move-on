import assert from "node:assert/strict";
import test from "node:test";
import { matchRoute, normalizeApiPath } from "../src/router-match.ts";

test("normalizeApiPath", () => {
  assert.equal(normalizeApiPath("health"), "/api/health");
  assert.equal(normalizeApiPath(["admin", "v1", "me"]), "/api/admin/v1/me");
  assert.equal(normalizeApiPath("admin/v1/me"), "/api/admin/v1/me");
});

test("matchRoute", () => {
  assert.ok(matchRoute("GET", "/api/health"));
  assert.ok(matchRoute("POST", "/api/admin/v1/auth/login"));
  assert.equal(matchRoute("GET", "/api/admin/v1/programs")?.name, "programs-list");
  assert.equal(matchRoute("POST", "/api/admin/v1/videos/upload")?.name, "videos-upload");
  assert.equal(matchRoute("GET", "/api/admin/v1/skins")?.name, "skins-list");
  assert.equal(matchRoute("GET", "/api/admin/v1/stores")?.name, "stores-list");
  assert.equal(matchRoute("POST", "/api/player/v1/code")?.name, "player-code");
  assert.equal(matchRoute("GET", "/api/player/v1/programs")?.auth, "player");
  assert.equal(matchRoute("GET", "/api/player/v1/code/123456/status")?.name, "player-code-status");
});