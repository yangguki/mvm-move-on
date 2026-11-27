export type HtmlSkinSlotOverlayBox = {
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
};

/** Stage-scaled pixel box for an HTML skin slot overlay on the player wrap. */
export function computeHtmlSkinSlotOverlayBox(
  stageOffsetX: number,
  stageOffsetY: number,
  slotLeft: number,
  slotTop: number,
  slotWidth: number,
  slotHeight: number,
  scale: number,
): HtmlSkinSlotOverlayBox {
  return {
    leftPx: stageOffsetX + slotLeft * scale,
    topPx: stageOffsetY + slotTop * scale,
    widthPx: slotWidth * scale,
    heightPx: slotHeight * scale,
  };
}

/** Overlay element is the <img> or <video> — use pixel size; never 100% of the full wrap. */
export function directMediaSlotOverlayCss(box: HtmlSkinSlotOverlayBox): Record<string, string> {
  return {
    display: "block",
    left: `${box.leftPx}px`,
    top: `${box.topPx}px`,
    width: `${box.widthPx}px`,
    height: `${box.heightPx}px`,
    overflow: "hidden",
    objectFit: "cover",
  };
}

/** YouTube main slot uses a wrapper; inner placeholder may use 100% of this box. */
export function youtubeWrapperSlotOverlayCss(box: HtmlSkinSlotOverlayBox): Record<string, string> {
  return {
    display: "block",
    left: `${box.leftPx}px`,
    top: `${box.topPx}px`,
    width: `${box.widthPx}px`,
    height: `${box.heightPx}px`,
    overflow: "hidden",
  };
}