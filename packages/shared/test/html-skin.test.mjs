import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertHtmlSkinContentSize,
  buildHtmlSkinSrcdoc,
  collectScreenIds,
  sanitizeHtmlSkinContent,
  validateHtmlProgramSteps,
  HTML_SKIN_CONTENT_MAX_BYTES,
} from "../dist/index.js";
import { loadNeonArcadeHtmlScreens } from "../neon-arcade-screens/load.mjs";

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

describe("validateHtmlProgramSteps", () => {
  const screens = [
    { id: "title", hasVideoSlot: false, hasNextVideoSlot: false, titleOnly: true },
    { id: "main", hasVideoSlot: true, hasNextVideoSlot: false, titleOnly: false },
    { id: "next", hasVideoSlot: false, hasNextVideoSlot: true, titleOnly: false },
  ];

  it("screenId 필수", () => {
    const items = [{ id: "s1", type: "exercise", durationSec: 10 }];
    assert.throws(() => validateHtmlProgramSteps(items, screens), /screenId가 필요해요/);
  });

  it("영상 슬롯 화면은 videoId 필수", () => {
    const items = [{ id: "s1", type: "exercise", durationSec: 10, screenId: "main" }];
    assert.throws(() => validateHtmlProgramSteps(items, screens), /videoId가 필요해요/);
  });

  it("슬롯 없는 화면에 videoId 금지", () => {
    const items = [{ id: "s1", type: "guide", durationSec: 10, screenId: "title", videoId: "v1" }];
    assert.throws(() => validateHtmlProgramSteps(items, screens), /videoId를 넣을 수 없어요/);
  });

  it("유효한 html 스텝 통과", () => {
    const items = [
      { id: "s1", type: "guide", durationSec: 10, screenId: "title" },
      { id: "s2", type: "exercise", durationSec: 30, screenId: "main", videoId: "v1" },
      { id: "s3", type: "rest", durationSec: 15, screenId: "next" },
    ];
    assert.doesNotThrow(() => validateHtmlProgramSteps(items, screens));
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

describe("neon-arcade html screens", () => {
  const screens = loadNeonArcadeHtmlScreens();

  it("loads 10 POWER BELL screens", () => {
    assert.equal(screens.length, 10);
    assert.deepEqual(
      screens.map((s) => s.title),
      [
        "수업 대기",
        "웜업 타이틀",
        "웜업",
        "운동 대기",
        "운동",
        "휴식",
        "체인지",
        "체인지 후 미리보기",
        "쿨다운 타이틀",
        "완료",
      ],
    );
  });

  for (const screen of screens) {
    it(`sanitizes and fits 200KB: ${screen.title}`, () => {
      const { html, css } = sanitizeHtmlSkinContent(screen.html, screen.css);
      assertHtmlSkinContentSize(html, css, HTML_SKIN_CONTENT_MAX_BYTES);
      assert(html.includes("na-stage") || html.includes("na-"));
    });
  }
});