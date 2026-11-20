import {
  assertHtmlSkinContentSize,
  HTML_SKIN_CONTENT_MAX_BYTES,
  sanitizeHtmlSkinContent,
} from "../html-skin";
import type { HtmlSkinScreensMap, SkinScreenSnapshot } from "../program";

export function presentHtmlSkinScreenSnapshot(row: {
  id: string;
  title: string;
  html: string;
  css: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
  version: number;
}): SkinScreenSnapshot {
  const { html, css } = sanitizeHtmlSkinContent(row.html, row.css);
  return {
    id: row.id,
    title: row.title,
    html,
    css,
    hasVideoSlot: row.hasVideoSlot,
    hasNextVideoSlot: row.hasNextVideoSlot,
    titleOnly: row.titleOnly,
    version: row.version,
  };
}

/** 프로그램 items에 나온 화면 id + 미지정 시 fallback(첫 video 슬롯 또는 첫 화면). */
export function resolveHtmlPublishScreenIds(
  screenIds: string[],
  allScreens: { id: string; hasVideoSlot: boolean }[],
): Set<string> {
  const usedIds = new Set(screenIds);
  if (usedIds.size === 0 && allScreens.length > 0) {
    const fallback = allScreens.find((s) => s.hasVideoSlot) ?? allScreens[0];
    if (fallback) usedIds.add(fallback.id);
  }
  return usedIds;
}

export function buildHtmlSkinScreensMap(
  rows: {
    id: string;
    title: string;
    html: string;
    css: string;
    hasVideoSlot: boolean;
    hasNextVideoSlot: boolean;
    titleOnly: boolean;
    version: number;
  }[],
): HtmlSkinScreensMap {
  const map: HtmlSkinScreensMap = {};
  for (const row of rows) {
    assertHtmlSkinContentSize(row.html, row.css, HTML_SKIN_CONTENT_MAX_BYTES);
    map[row.id] = presentHtmlSkinScreenSnapshot(row);
  }
  return map;
}

export function snapshotScreenVersions(map: HtmlSkinScreensMap | undefined): Record<string, number> {
  if (!map) return {};
  const out: Record<string, number> = {};
  for (const [id, screen] of Object.entries(map)) out[id] = screen.version;
  return out;
}