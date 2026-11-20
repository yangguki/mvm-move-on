import assert from "node:assert/strict";
import test from "node:test";
import { matchRoute } from "../src/router-match.ts";

test("skin and screen route matching", () => {
  assert.equal(matchRoute("GET", "/api/admin/v1/skins")?.name, "skins-list");
  assert.equal(matchRoute("POST", "/api/admin/v1/skins")?.name, "skins-create");
  assert.equal(matchRoute("GET", "/api/admin/v1/skins/neon-arcade")?.name, "skins-detail");
  assert.equal(matchRoute("PATCH", "/api/admin/v1/skins/neon-arcade")?.name, "skins-update");
  assert.equal(matchRoute("DELETE", "/api/admin/v1/skins/neon-arcade")?.name, "skins-delete");

  const skinId = "11111111-1111-1111-1111-111111111111";
  const screenId = "22222222-2222-2222-2222-222222222222";
  const base = `/api/admin/v1/skins/${skinId}/screens`;
  assert.equal(matchRoute("GET", base)?.name, "screens-list");
  assert.equal(matchRoute("POST", `${base}/reorder`)?.name, "screens-reorder");
  assert.equal(matchRoute("POST", base)?.name, "screens-create");
  assert.equal(matchRoute("GET", `${base}/${screenId}/usage`)?.name, "screens-usage");
  assert.equal(matchRoute("POST", `${base}/${screenId}/duplicate`)?.name, "screens-duplicate");
  assert.equal(matchRoute("POST", `${base}/${screenId}/move`)?.name, "screens-move");
  assert.equal(matchRoute("GET", `${base}/${screenId}`)?.name, "screens-detail");
  assert.equal(matchRoute("PATCH", `${base}/${screenId}`)?.name, "screens-update");
  assert.equal(matchRoute("DELETE", `${base}/${screenId}`)?.name, "screens-delete");
});

test("video and program route matching", () => {
  assert.equal(matchRoute("GET", "/api/admin/v1/videos")?.name, "videos-list");
  assert.equal(matchRoute("POST", "/api/admin/v1/videos/upload")?.name, "videos-upload");
  assert.equal(matchRoute("GET", "/api/admin/v1/videos/vid-1")?.name, "videos-detail");
  assert.equal(matchRoute("POST", "/api/admin/v1/programs/p1/publish")?.name, "programs-publish");
  assert.equal(matchRoute("GET", "/api/admin/v1/programs/p1/versions")?.name, "programs-versions");
  assert.equal(matchRoute("PUT", "/api/admin/v1/programs/p1")?.name, "programs-save");
});