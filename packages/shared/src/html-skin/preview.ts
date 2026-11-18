import type { SkinScreenSnapshot } from "../program";
import { resolveStepScreen } from "./screens";
import { sanitizeHtmlSkinContent } from "./sanitize";
import type { HtmlSkinTokenMap } from "./tokens";

/** {{token}} 치환 (미리보기·검증용, 스크립트 없이 정적 채움) */
export function fillSkinTokens(content: string, tokens: HtmlSkinTokenMap): string {
  return content.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => {
    const v = tokens[String(key).trim()];
    return v == null ? "" : String(v);
  });
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** HTML 스킨 슬롯용 video 마크업 — native controls 없음 (muted autoplay playsinline loop). */
export function htmlSkinSlotVideoTag(videoUrl: string): string {
  return `<video src="${escapeAttr(videoUrl)}" style="width:100%;height:100%;object-fit:cover;display:block" muted autoplay playsinline loop></video>`;
}

function injectVideoIntoSlot(html: string, attr: string, videoUrl: string | null | undefined): string {
  if (!videoUrl) return html;
  const video = htmlSkinSlotVideoTag(videoUrl);
  const re = new RegExp(`(<[^>]*\\b${attr}\\b[^>]*>)([\\s\\S]*?)(<\\/[^>]+>)`, "i");
  if (!re.test(html)) return html;
  return html.replace(re, `$1${video}$3`);
}

export type HtmlSkinStepPreviewScreen = Pick<
  SkinScreenSnapshot,
  "id" | "html" | "css" | "hasVideoSlot" | "hasNextVideoSlot" | "titleOnly"
> & { title?: string; version?: number };

export type BuildHtmlSkinStepPreviewInput = {
  screens: HtmlSkinStepPreviewScreen[] | Record<string, HtmlSkinStepPreviewScreen>;
  screenId: string | undefined;
  tokens: HtmlSkinTokenMap;
  /** 메인 영상 슬롯([data-mvn-video]) */
  videoUrl?: string | null;
  /** NEXT 영상 슬롯([data-mvn-next-video]) */
  nextVideoUrl?: string | null;
  /** srcdoc에서 /skins/... 상대경로 해석용 (예: https://admin/ 또는 /) */
  baseHref: string;
};

function toOrderedAndMap(
  screens: BuildHtmlSkinStepPreviewInput["screens"],
): { ordered: SkinScreenSnapshot[]; map: Record<string, SkinScreenSnapshot> } {
  const list = Array.isArray(screens) ? screens : Object.values(screens);
  const ordered: SkinScreenSnapshot[] = list.map((s) => ({
    id: s.id,
    title: s.title ?? s.id,
    html: s.html,
    css: s.css,
    hasVideoSlot: s.hasVideoSlot ?? false,
    hasNextVideoSlot: s.hasNextVideoSlot ?? false,
    titleOnly: s.titleOnly ?? false,
    version: s.version ?? 1,
  }));
  const map = Object.fromEntries(ordered.map((s) => [s.id, s]));
  return { ordered, map };
}

/**
 * 빌더 중앙 미리보기용 정적 srcdoc.
 * sanitize + 토큰 채움 + video src 주입, <script> 없음, <base>로 /skins 자산 해석.
 */
export function buildHtmlSkinStepPreviewDocument(input: BuildHtmlSkinStepPreviewInput): string {
  const { ordered, map } = toOrderedAndMap(input.screens);
  const screen = resolveStepScreen(input.screenId, map, ordered);
  const rawHtml = screen?.html ?? "";
  const rawCss = screen?.css ?? "";
  const { html: cleanHtml, css: cleanCss } = sanitizeHtmlSkinContent(rawHtml, rawCss);
  let html = fillSkinTokens(cleanHtml, input.tokens);
  const css = fillSkinTokens(cleanCss, input.tokens);
  html = injectVideoIntoSlot(html, "data-mvn-video", input.videoUrl);
  html = injectVideoIntoSlot(html, "data-mvn-next-video", input.nextVideoUrl);

  const base = escapeAttr(input.baseHref || "/");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${base}"><style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}
#mvn-screen{position:relative;width:1920px;height:1080px;transform-origin:top left;transform:scale(calc(100vw / 1920))}
${css}
</style></head><body><div id="mvn-screen">${html}</div></body></html>`;
}
