import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  computeHtmlSkinSlotOverlayBox,
  directMediaSlotOverlayCss,
  youtubeWrapperSlotOverlayCss,
} from "../dist/html-skin/slot-overlay.js";

describe("computeHtmlSkinSlotOverlayBox", () => {
  it("scales slot rect and adds stage offset", () => {
    const box = computeHtmlSkinSlotOverlayBox(40, 20, 100, 50, 200, 100, 0.5);
    assert.equal(box.leftPx, 90);
    assert.equal(box.topPx, 45);
    assert.equal(box.widthPx, 100);
    assert.equal(box.heightPx, 50);
  });
});

describe("directMediaSlotOverlayCss", () => {
  it("uses pixel dimensions and overflow hidden, not percent width", () => {
    const css = directMediaSlotOverlayCss({ leftPx: 10, topPx: 20, widthPx: 120, heightPx: 80 });
    assert.equal(css.width, "120px");
    assert.equal(css.height, "80px");
    assert.equal(css.overflow, "hidden");
    assert.equal(css.objectFit, "cover");
    assert.ok(!css.width?.includes("%"));
  });
});

describe("youtubeWrapperSlotOverlayCss", () => {
  it("clips wrapper without object-fit on the container", () => {
    const css = youtubeWrapperSlotOverlayCss({ leftPx: 0, topPx: 0, widthPx: 640, heightPx: 360 });
    assert.equal(css.overflow, "hidden");
    assert.equal(css.objectFit, undefined);
  });
});