import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compactSortOrderAssignments,
  duplicateScreenTitle,
  neighborSwapIndex,
  parseForceFlag,
  parseMoveDirection,
  SkinScreenOpsError,
} from "../../../packages/shared/dist/index.js";

describe("duplicateScreenTitle", () => {
  it("appends copy suffix", () => {
    assert.equal(duplicateScreenTitle("메인"), "메인 (복사본)");
  });
});

describe("parseForceFlag", () => {
  it("accepts 1 variants", () => {
    assert.equal(parseForceFlag("1"), true);
    assert.equal(parseForceFlag(1), true);
    assert.equal(parseForceFlag(undefined), false);
  });
});

describe("parseMoveDirection", () => {
  it("accepts up and down", () => {
    assert.equal(parseMoveDirection("up"), "up");
    assert.equal(parseMoveDirection("down"), "down");
  });

  it("rejects invalid", () => {
    assert.throws(() => parseMoveDirection("left"), SkinScreenOpsError);
  });
});

describe("neighborSwapIndex", () => {
  const ids = ["a", "b", "c"];

  it("swaps up", () => {
    assert.equal(neighborSwapIndex(ids, "b", "up"), 0);
    assert.equal(neighborSwapIndex(ids, "a", "up"), null);
  });

  it("swaps down", () => {
    assert.equal(neighborSwapIndex(ids, "b", "down"), 2);
    assert.equal(neighborSwapIndex(ids, "c", "down"), null);
  });
});

describe("compactSortOrderAssignments", () => {
  it("reindexes from zero", () => {
    assert.deepEqual(
      compactSortOrderAssignments([
        { id: "x", sortOrder: 5 },
        { id: "y", sortOrder: 2 },
      ]),
      [
        { id: "y", sortOrder: 0 },
        { id: "x", sortOrder: 1 },
      ],
    );
  });
});