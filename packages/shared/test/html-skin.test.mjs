import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertHtmlSkinContentSize,
  buildHtmlSkinSrcdoc,
  collectScreenIds,
  sanitizeHtmlSkinContent,
  HTML_SKIN_CONTENT_MAX_BYTES,
} from "../dist/index.js";

describe("html-skin sanitize", () => {
  it("removes script tags and on* handlers", () => {
    const raw = `<div onclick="alert(1)">x</div><script>evil()</script><img src="javascript:alert(1)">`;
    const { html } = sanitizeHtmlSkinContent(raw, "");
    assert(!html.includes("<script"));
    assert(!html.includes("onclick"));
    assert(!html.includes("javascript:"));
  });

  it("enforces 200KB limit", () => {
    const big = "a".repeat(HTML_SKIN_CONTENT_MAX_BYTES);
    assert.throws(() => assertHtmlSkinContentSize(big, "bb", HTML_SKIN_CONTENT_MAX_BYTES));
  });

  it("builds srcdoc with CSP nonce", () => {
    const doc = buildHtmlSkinSrcdoc("<p>{{label}}</p>", "body{color:#fff}", {
      imgSrc: "'self'",
      mediaSrc: "'self'",
      fontSrc: "'self'",
    }, "test-nonce");
    assert(doc.includes("nonce-test-nonce"));
    assert(doc.includes("script-src 'nonce-test-nonce'"));
    assert(doc.includes("{{label}}"));
  });
});

describe("collectScreenIds", () => {
  it("collects from steps and groups", () => {
    const items = [
      { id: "s1", type: "exercise", durationSec: 10, screenId: "a" },
      { id: "g1", type: "group", repeat: 2, steps: [{ id: "s2", type: "rest", durationSec: 5, screenId: "b" }] },
    ];
    assert.deepEqual(collectScreenIds(items).sort(), ["a", "b"]);
  });
});