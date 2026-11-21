import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isYouTubeUrl,
  parseYouTubeVideoId,
  resolveExternalVideoThumbnail,
  youtubeNocookieEmbedUrl,
  youtubeThumbnailUrl,
} from "../dist/youtube.js";

const SAMPLE = "M1bNbM_WBUw";

describe("parseYouTubeVideoId", () => {
  it("parses watch URLs with extra query params", () => {
    assert.equal(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${SAMPLE}`), SAMPLE);
    assert.equal(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${SAMPLE}&t=42s`), SAMPLE);
    assert.equal(parseYouTubeVideoId(`https://m.youtube.com/watch?v=${SAMPLE}&feature=share`), SAMPLE);
  });

  it("parses short, embed, shorts, and nocookie hosts", () => {
    assert.equal(parseYouTubeVideoId(`https://youtu.be/${SAMPLE}`), SAMPLE);
    assert.equal(parseYouTubeVideoId(`https://www.youtube.com/embed/${SAMPLE}`), SAMPLE);
    assert.equal(parseYouTubeVideoId(`https://www.youtube.com/shorts/${SAMPLE}`), SAMPLE);
    assert.equal(parseYouTubeVideoId(`https://www.youtube-nocookie.com/embed/${SAMPLE}`), SAMPLE);
  });

  it("rejects non-YouTube and invalid ids", () => {
    assert.equal(parseYouTubeVideoId("https://vimeo.com/123"), null);
    assert.equal(parseYouTubeVideoId("https://www.youtube.com/watch?v=tooshort"), null);
    assert.equal(parseYouTubeVideoId(""), null);
  });
});

describe("isYouTubeUrl", () => {
  it("matches parseYouTubeVideoId", () => {
    assert.equal(isYouTubeUrl(`https://youtu.be/${SAMPLE}`), true);
    assert.equal(isYouTubeUrl("https://cdn.example/v.mp4"), false);
  });
});

describe("youtubeThumbnailUrl", () => {
  it("builds hqdefault jpg URL", () => {
    assert.equal(youtubeThumbnailUrl(SAMPLE), `https://img.youtube.com/vi/${SAMPLE}/hqdefault.jpg`);
  });
});

describe("youtubeNocookieEmbedUrl", () => {
  it("includes mute and autoplay", () => {
    const url = youtubeNocookieEmbedUrl(SAMPLE);
    assert.match(url, /^https:\/\/www\.youtube-nocookie\.com\/embed\/M1bNbM_WBUw\?/);
    assert.match(url, /autoplay=1/);
    assert.match(url, /mute=1/);
  });
});

describe("resolveExternalVideoThumbnail", () => {
  it("uses YouTube thumbnail when thumbnail matches url", () => {
    const watch = `https://www.youtube.com/watch?v=${SAMPLE}`;
    assert.equal(resolveExternalVideoThumbnail(watch, watch), youtubeThumbnailUrl(SAMPLE));
    assert.equal(resolveExternalVideoThumbnail(watch), youtubeThumbnailUrl(SAMPLE));
  });

  it("keeps custom thumbnail for non-YouTube", () => {
    assert.equal(resolveExternalVideoThumbnail("https://cdn/x.mp4", "https://cdn/thumb.jpg"), "https://cdn/thumb.jpg");
  });
});