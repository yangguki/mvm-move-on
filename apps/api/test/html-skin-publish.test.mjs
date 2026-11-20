import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { snapshotScreenVersions } from "../../../packages/shared/dist/index.js";

describe("snapshotScreenVersions", () => {
  it("maps screen id to version", () => {
    const map = {
      a: { id: "a", title: "t", html: "", css: "", hasVideoSlot: true, hasNextVideoSlot: false, titleOnly: false, version: 3 },
    };
    assert.deepEqual(snapshotScreenVersions(map), { a: 3 });
  });
});