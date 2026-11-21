import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertHtmlSkinContentSize,
  buildHtmlSkinSrcdoc,
  buildHtmlSkinStepPreviewDocument,
  collectScreenIds,
  fillSkinTokens,
  htmlSkinLiveTokensHasMarkers,
  markHtmlSkinLiveTokens,
  parseHtmlSkinStepText,
  refreshHtmlSkinLiveTokens,
  sanitizeHtmlSkinContent,
  stripStaleHtmlProgramVideoIds,
  validateHtmlProgramSteps,
  collectMissingHtmlProgramScreens,
  missingPublishScreensMessage,
  collectMissingHtmlProgramVideos,
  missingPublishHtmlVideosMessage,
  HTML_SKIN_CONTENT_MAX_BYTES,
  HTML_SKIN_SAMPLE_TOKENS,
} from "../dist/index.js";
import { loadNeonArcadeHtmlScreens } from "../neon-arcade-screens/load.mjs";
import { loadIptPowerBellHtmlScreens } from "../ipt-power-bell-screens/load.mjs";

describe("html-skin live tokens", () => {
  it("marks then refreshes remainingSec without placeholders left", () => {
    const raw = `<span class="n">{{remainingSec}}</span> / {{totalSec}}`;
    const marked = markHtmlSkinLiveTokens(raw, { remainingSec: 10, totalSec: 45 });
    assert(htmlSkinLiveTokensHasMarkers(marked));
    assert.match(marked, /data-mvn-token="remainingSec">10</);
    const updated = refreshHtmlSkinLiveTokens(marked, { remainingSec: 7, totalSec: 45 });
    assert.match(updated, /data-mvn-token="remainingSec">7</);
    assert.doesNotMatch(updated, /\{\{/);
  });
});

describe("parseHtmlSkinStepText", () => {
  it("parses set= and defaults round", () => {
    assert.deepEqual(parseHtmlSkinStepText("set=2/3"), { set: 2, setTotal: 3, round: 1, roundTotal: 1 });
    assert.deepEqual(parseHtmlSkinStepText("round=2/4 set=1/3"), { set: 1, setTotal: 3, round: 2, roundTotal: 4 });
  });
});

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

  it("publish: 영상 슬롯 화면은 videoId 필수", () => {
    const items = [{ id: "s1", type: "exercise", durationSec: 10, screenId: "main" }];
    assert.throws(() => validateHtmlProgramSteps(items, screens), /videoId가 필요해요/);
    assert.throws(() => validateHtmlProgramSteps(items, screens, "publish"), /videoId가 필요해요/);
  });

  it("draft: 영상 슬롯에 videoId 없어도 저장 가능", () => {
    const items = [{ id: "s1", type: "exercise", durationSec: 10, screenId: "main" }];
    assert.doesNotThrow(() => validateHtmlProgramSteps(items, screens, "draft"));
  });

  it("슬롯 없는 화면에 videoId 금지 (publish)", () => {
    const items = [{ id: "s1", type: "guide", durationSec: 10, screenId: "title", videoId: "v1", label: "타이틀" }];
    assert.throws(() => validateHtmlProgramSteps(items, screens), /1단계 "타이틀".*videoId를 넣을 수 없어요/);
  });

  it("stripStaleHtmlProgramVideoIds removes stale videoId", () => {
    const items = [{ id: "s1", type: "guide", durationSec: 10, screenId: "title", videoId: "v1" }];
    const stripped = stripStaleHtmlProgramVideoIds(items, screens);
    assert.equal(stripped[0].videoId, undefined);
    assert.doesNotThrow(() => validateHtmlProgramSteps(stripped, screens, "publish"));
  });

  it("draft: strip 후 슬롯 없는 화면 videoId 통과", () => {
    const raw = [{ id: "s1", type: "guide", durationSec: 10, screenId: "title", videoId: "v1" }];
    const items = stripStaleHtmlProgramVideoIds(raw, screens);
    assert.doesNotThrow(() => validateHtmlProgramSteps(items, screens, "draft"));
  });

  it("유효한 html 스텝 통과", () => {
    const items = [
      { id: "s1", type: "guide", durationSec: 10, screenId: "title" },
      { id: "s2", type: "exercise", durationSec: 30, screenId: "main", videoId: "v1" },
      { id: "s3", type: "rest", durationSec: 15, screenId: "next" },
    ];
    assert.doesNotThrow(() => validateHtmlProgramSteps(items, screens));
  });

  it("draft: 삭제된 screenId는 저장 가능 (video 슬롯 검사 생략)", () => {
    const items = [
      { id: "s1", type: "exercise", durationSec: 10, screenId: "deleted-screen" },
      { id: "s2", type: "guide", durationSec: 5, screenId: "title" },
    ];
    assert.doesNotThrow(() => validateHtmlProgramSteps(items, screens, "draft"));
    assert.throws(
      () => validateHtmlProgramSteps(items, screens, "publish"),
      /screenId가 이 스킨의 화면이 아니에요/,
    );
  });

  it("publish: 삭제된 화면 단계 메시지", () => {
    const items = [
      { id: "s1", type: "guide", durationSec: 10, screenId: "title" },
      { id: "s2", type: "exercise", durationSec: 30, screenId: "gone" },
      { id: "s3", type: "rest", durationSec: 10, screenId: "also-gone" },
    ];
    const missing = collectMissingHtmlProgramScreens(items, screens);
    assert.deepEqual(missing.map((step) => step.stepNumber), [2, 3]);
    assert.match(missingPublishScreensMessage(missing) ?? "", /2, 3단계/);
    assert.match(missingPublishScreensMessage(missing) ?? "", /삭제된 화면/);
  });

  it("publish: 영상 없는 단계 메시지", () => {
    const items = [
      { id: "s1", type: "guide", durationSec: 10, screenId: "title" },
      { id: "s2", type: "exercise", durationSec: 30, screenId: "main", label: "메인 운동" },
      { id: "s3", type: "rest", durationSec: 10, screenId: "next" },
    ];
    const missing = collectMissingHtmlProgramVideos(items, screens);
    assert.deepEqual(missing.map((step) => step.stepNumber), [2]);
    assert.match(missingPublishHtmlVideosMessage(missing) ?? "", /2단계 "메인 운동"/);
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

describe("buildHtmlSkinStepPreviewDocument", () => {
  const screens = [
    {
      id: "title",
      title: "타이틀",
      html: `<h1>{{label}}</h1><p>{{program.name}}</p><script>evil()</script>`,
      css: "h1{color:{{pointColor}}}",
      hasVideoSlot: false,
      hasNextVideoSlot: false,
      titleOnly: true,
    },
    {
      id: "exercise",
      title: "운동",
      html: `<div data-mvn-video class="slot"></div><span>{{label}}</span><span>{{remainingSec}}</span>`,
      css: ".slot{width:100px}",
      hasVideoSlot: true,
      hasNextVideoSlot: false,
      titleOnly: false,
    },
    {
      id: "change",
      title: "체인지",
      html: `<h1>{{label}}</h1>`,
      css: "",
      hasVideoSlot: false,
      hasNextVideoSlot: false,
      titleOnly: true,
    },
  ];

  it("picks screen by screenId, fills tokens, embeds video, no script", () => {
    const doc = buildHtmlSkinStepPreviewDocument({
      screens,
      screenId: "exercise",
      tokens: { ...HTML_SKIN_SAMPLE_TOKENS, label: "덤벨 스윙", remainingSec: 42 },
      videoUrl: "https://cdn.example/v1.mp4",
      baseHref: "http://localhost:3000/",
    });
    assert.match(doc, /<base href="http:\/\/localhost:3000\/"/);
    assert.match(doc, /덤벨 스윙/);
    assert.match(doc, />42</);
    assert.match(doc, /<video src="https:\/\/cdn\.example\/v1\.mp4"/);
    assert.doesNotMatch(doc, /<script/i);
    assert.doesNotMatch(doc, /\{\{/);
    assert.match(doc, /id="mvn-screen"/);
  });

  it("injected video has muted autoplay playsinline loop and no controls", () => {
    const doc = buildHtmlSkinStepPreviewDocument({
      screens,
      screenId: "exercise",
      tokens: { ...HTML_SKIN_SAMPLE_TOKENS, label: "덤벨 스윙", remainingSec: 42 },
      videoUrl: "https://cdn.example/v1.mp4",
      baseHref: "/",
    });
    const videoMatch = doc.match(/<video\b[^>]*>/i);
    assert.ok(videoMatch, "video tag expected");
    const tag = videoMatch[0];
    assert.match(tag, /\bmuted\b/i);
    assert.match(tag, /\bautoplay\b/i);
    assert.match(tag, /\bplaysinline\b/i);
    assert.match(tag, /\bloop\b/i);
    assert.doesNotMatch(tag, /\bcontrols\b/i);
  });

  it("uses requested title screen when screenId is title", () => {
    const doc = buildHtmlSkinStepPreviewDocument({
      screens,
      screenId: "title",
      tokens: { label: "WARM UP", "program.name": "POWER BELL", pointColor: "#0ff" },
      baseHref: "/",
    });
    assert.match(doc, /WARM UP/);
    assert.match(doc, /POWER BELL/);
    assert.match(doc, /color:#0ff/);
    assert.doesNotMatch(doc, /data-mvn-video/);
    assert.doesNotMatch(doc, /<script/i);
  });

  it("unknown screenId shows placeholder (no video-slot fallback)", () => {
    const doc = buildHtmlSkinStepPreviewDocument({
      screens,
      screenId: "deleted-id",
      tokens: { label: "orphan" },
      baseHref: "/",
    });
    assert.match(doc, /화면 없음/);
    assert.doesNotMatch(doc, /data-mvn-video/);
  });

  it("falls back to video screen when screenId missing", () => {
    const doc = buildHtmlSkinStepPreviewDocument({
      screens,
      screenId: undefined,
      tokens: { label: "fallback-label" },
      videoUrl: "/skins/x/a.mp4",
      baseHref: "/",
    });
    assert.match(doc, /fallback-label/);
    assert.match(doc, /data-mvn-video/);
    assert.match(doc, /src="\/skins\/x\/a\.mp4"/);
  });

  it("embeds YouTube via youtube-nocookie iframe", () => {
    const doc = buildHtmlSkinStepPreviewDocument({
      screens,
      screenId: "exercise",
      tokens: { ...HTML_SKIN_SAMPLE_TOKENS, label: "YT", remainingSec: 30 },
      videoUrl: "https://www.youtube.com/watch?v=M1bNbM_WBUw",
      baseHref: "/",
    });
    assert.match(doc, /<iframe[^>]*youtube-nocookie\.com\/embed\/M1bNbM_WBUw/);
    assert.doesNotMatch(doc, /<video src="https:\/\/www\.youtube\.com/);
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

describe("ipt-power-bell html screens", () => {
  const screens = loadIptPowerBellHtmlScreens();

  it("loads 12 iPT POWER BELL screens", () => {
    assert.equal(screens.length, 12);
    assert.deepEqual(
      screens.map((s) => s.slug),
      [
        "intro",
        "warmup-title",
        "warmup",
        "workout-wait",
        "preview",
        "exercise",
        "rest",
        "change",
        "change-preview",
        "cooldown-title",
        "cooldown",
        "completed",
      ],
    );
    assert.deepEqual(
      screens.map((s) => s.title),
      [
        "수업 대기",
        "웜업 타이틀",
        "웜업",
        "운동 대기",
        "미리보기",
        "운동",
        "휴식",
        "체인지",
        "체인지 후 미리보기",
        "쿨다운 타이틀",
        "쿨다운",
        "완료",
      ],
    );
  });

  for (const screen of screens) {
    it(`sanitizes, no script, fits 200KB: ${screen.slug}`, () => {
      const { html, css } = sanitizeHtmlSkinContent(screen.html, screen.css);
      assertHtmlSkinContentSize(html, css, HTML_SKIN_CONTENT_MAX_BYTES);
      assert(!/<script/i.test(html));
      assert(!/\bon\w+\s*=/i.test(html));
      assert(html.includes("ipb-stage"));
    });

    it(`sample tokens leave no "{{": ${screen.slug}`, () => {
      const filledHtml = fillSkinTokens(screen.html, HTML_SKIN_SAMPLE_TOKENS);
      const filledCss = fillSkinTokens(screen.css, HTML_SKIN_SAMPLE_TOKENS);
      assert(!filledHtml.includes("{{"), `html still has tokens: ${screen.slug}`);
      assert(!filledCss.includes("{{"), `css still has tokens: ${screen.slug}`);
    });
  }

  it("slot flags match mockup roles", () => {
    const bySlug = Object.fromEntries(screens.map((s) => [s.slug, s]));
    assert.equal(bySlug.warmup.hasVideoSlot, true);
    assert.equal(bySlug.warmup.hasNextVideoSlot, true);
    assert.equal(bySlug.exercise.hasVideoSlot, true);
    assert.equal(bySlug.rest.hasNextVideoSlot, true);
    assert.equal(bySlug.preview.hasNextVideoSlot, true);
    assert.equal(bySlug.change.titleOnly, true);
    assert.equal(bySlug.intro.titleOnly, true);
  });
});
