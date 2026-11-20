import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftContentDiffersFromPublished,
  pickScreenVersionsForItems,
  republishSkinTokensDiffPaths,
  screenVersionsEqual,
} from "../../../packages/shared/dist/index.js";

describe("draftContentDiffersFromPublished", () => {
  const items = [
    { id: "ex-1", type: "exercise", durationSec: 10, label: "a", screenId: "scr-a", videoId: "v1" },
    { id: "rest-1", type: "rest", durationSec: 5, label: "b", screenId: "scr-b" },
  ];
  const draftSkin = {
    id: "neon-arcade",
    kind: "html",
    options: { pointColor: "#C8F31D", nextLeadSec: 3 },
  };
  const publishedSkin = {
    ...draftSkin,
    screens: {
      "scr-a": { id: "scr-a", title: "웜업", html: "<motion.div class='na-stage'>", css: "x", hasVideoSlot: true, hasNextVideoSlot: false, titleOnly: false, version: 1 },
      "scr-b": { id: "scr-b", title: "휴식", html: "y", css: "z", hasVideoSlot: false, hasNextVideoSlot: true, titleOnly: false, version: 1 },
    },
    music: { id: "m1", name: "bg", url: "https://example.com/a.mp3", durationSec: 60 },
  };

  it("ignores publish-only skin fields right after publish", () => {
    assert.equal(
      draftContentDiffersFromPublished(
        { items, skin: draftSkin },
        { items, skin: publishedSkin },
      ),
      false,
    );
  });

  it("detects draft item edits", () => {
    const edited = items.map((s) => (s.id === "rest-1" ? { ...s, durationSec: 6 } : s));
    assert.equal(
      draftContentDiffersFromPublished({ items: edited, skin: draftSkin }, { items, skin: publishedSkin }),
      true,
    );
  });

  it("ignores extra resolved option ids on published skin", () => {
    const publishedOpts = {
      pointColor: "#C8F31D",
      nextLeadSec: 3,
      musicId: "default-music",
      voicePackId: "default-voice",
    };
    assert.equal(
      draftContentDiffersFromPublished(
        { items, skin: draftSkin },
        { items, skin: { ...draftSkin, options: publishedOpts } },
      ),
      false,
    );
  });
});

describe("republishSkinTokensDiffPaths", () => {
  const tokens = { primaryColor: "#fff" };

  it("ignores live skin tokens when kind is html", () => {
    assert.deepEqual(republishSkinTokensDiffPaths("html", tokens, undefined), []);
  });

  it("flags token skin when publish snapshot tokens differ", () => {
    assert.deepEqual(republishSkinTokensDiffPaths("tokens", tokens, {}), ["skin.tokens"]);
  });
});

describe("screenVersionsEqual", () => {
  it("ignores object key order", () => {
    assert.equal(screenVersionsEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
  });
});

describe("pickScreenVersionsForItems", () => {
  it("keeps only screen ids referenced in program items", () => {
    const all = { a: 1, b: 2, c: 3 };
    const items = [
      { id: "s1", type: "exercise", durationSec: 1, label: "x", screenId: "a" },
      { id: "s2", type: "rest", durationSec: 1, label: "y", screenId: "b" },
    ];
    assert.deepEqual(pickScreenVersionsForItems(all, items), { a: 1, b: 2 });
  });
});