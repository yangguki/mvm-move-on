import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findFreeSlug,
  parseSkinCreateBody,
  SkinCreateBodyError,
  SKIN_NAME_MAX_LENGTH,
} from "../../../packages/shared/dist/index.js";

describe("parseSkinCreateBody", () => {
  it("defaults to html kind for name-only body", () => {
    const input = parseSkinCreateBody({ name: "Neon QA" });
    assert.equal(input.kind, "html");
    assert.equal(input.name, "Neon QA");
    assert.match(input.slug, /^neon-qa$/);
    assert.equal(input.slugWasExplicit, false);
  });

  it("marks slug as explicit when provided", () => {
    const input = parseSkinCreateBody({ name: "X", slug: "custom-slug" });
    assert.equal(input.slug, "custom-slug");
    assert.equal(input.slugWasExplicit, true);
  });

  it("rejects empty name", () => {
    assert.throws(() => parseSkinCreateBody({ name: "   " }), SkinCreateBodyError);
  });

  it("rejects name over max length", () => {
    const name = "a".repeat(SKIN_NAME_MAX_LENGTH + 1);
    assert.throws(() => parseSkinCreateBody({ name }), (error) => {
      assert.ok(error instanceof SkinCreateBodyError);
      assert.match(error.message, /60자/);
      return true;
    });
  });
});

describe("findFreeSlug", () => {
  it("returns base when unused", () => {
    const taken = new Set(["other"]);
    assert.equal(findFreeSlug("neon-qa", (s) => taken.has(s)), "neon-qa");
  });

  it("appends -2 when base is taken", () => {
    const taken = new Set(["neon-qa"]);
    assert.equal(findFreeSlug("neon-qa", (s) => taken.has(s)), "neon-qa-2");
  });

  it("skips to -3 when -2 is also taken", () => {
    const taken = new Set(["neon-qa", "neon-qa-2"]);
    assert.equal(findFreeSlug("neon-qa", (s) => taken.has(s)), "neon-qa-3");
  });
});