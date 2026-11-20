import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  programNamesUsingScreen,
  screenDeleteBlockedMessage,
  snapshotUsesScreen,
} from "../../../packages/shared/dist/index.js";

describe("snapshotUsesScreen", () => {
  it("detects screenId on draft items", () => {
    assert.equal(
      snapshotUsesScreen({ items: [{ id: "s1", type: "exercise", durationSec: 30, screenId: "scr-a" }] }, "scr-a"),
      true,
    );
    assert.equal(
      snapshotUsesScreen({ items: [{ id: "s1", type: "exercise", durationSec: 30, screenId: "other" }] }, "scr-a"),
      false,
    );
  });

  it("detects frozen screen in published skin.screens", () => {
    assert.equal(
      snapshotUsesScreen(
        {
          items: [],
          skin: { id: "html-skin", options: { pointColor: "#fff", nextLeadSec: 3 }, screens: { "scr-x": { id: "scr-x" } } },
        },
        "scr-x",
      ),
      true,
    );
  });

  it("walks nested groups", () => {
    assert.equal(
      snapshotUsesScreen(
        {
          items: [
            {
              id: "g1",
              type: "group",
              repeat: 2,
              steps: [{ id: "s1", type: "rest", durationSec: 10, screenId: "deep" }],
            },
          ],
        },
        "deep",
      ),
      true,
    );
  });
});

describe("programNamesUsingScreen", () => {
  it("dedupes names across draft and published", () => {
    const names = programNamesUsingScreen(
      [
        {
          name: "IPT",
          draft: { items: [{ id: "1", type: "guide", durationSec: 5, screenId: "u1" }] },
          publishedSnapshot: { items: [{ id: "1", type: "guide", durationSec: 5, screenId: "u1" }] },
        },
        { name: "Other", draft: { items: [] }, publishedSnapshot: null },
      ],
      "u1",
    );
    assert.deepEqual(names, ["IPT"]);
  });
});

describe("screenDeleteBlockedMessage", () => {
  it("returns null when unused", () => {
    assert.equal(screenDeleteBlockedMessage([]), null);
  });

  it("returns Korean message when blocked", () => {
    assert.ok(screenDeleteBlockedMessage(["P1"]));
    assert.match(screenDeleteBlockedMessage(["P1"]), /프로그램/);
  });
});