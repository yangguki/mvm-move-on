import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  builderDraftSnapshotKey,
  normalizeBuilderDirtySteps,
} from "../dist/admin-logic/builder-draft-snapshot.js";

describe("builder draft snapshot", () => {
  it("drops UI-only fields so dirty compare matches after save", () => {
    const withFlag = [
      {
        kind: "exercise",
        label: "A",
        subtitle: null,
        seconds: 30,
        videoId: "v1",
        screenId: null,
        groupKey: null,
        groupLabel: null,
        groupRepeat: null,
        durationUserEdited: true,
      },
    ];
    const withoutFlag = normalizeBuilderDirtySteps(withFlag);
    const keyA = builderDraftSnapshotKey("p", "skin", {}, withoutFlag);
    const keyB = builderDraftSnapshotKey("p", "skin", {}, normalizeBuilderDirtySteps(withFlag));
    assert.equal(keyA, keyB);
  });

  it("detects real step changes", () => {
    const base = normalizeBuilderDirtySteps([
      {
        kind: "exercise",
        label: "A",
        subtitle: null,
        seconds: 30,
        videoId: null,
        screenId: null,
        groupKey: null,
        groupLabel: null,
        groupRepeat: null,
      },
    ]);
    const key1 = builderDraftSnapshotKey("p", "skin", {}, base);
    const changed = [{ ...base[0], seconds: 31 }];
    const key2 = builderDraftSnapshotKey("p", "skin", {}, changed);
    assert.notEqual(key1, key2);
  });
});