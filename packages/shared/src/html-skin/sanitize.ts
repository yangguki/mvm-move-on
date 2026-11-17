const SCRIPT_TAG = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const ON_ATTR = /\s+on[a-z]+\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+)/gi;
const JS_URL = /\b(href|src|action|formaction|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi;
const META_REFRESH = /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi;
const BLOCKED_TAGS = /<\s*\/?\s*(iframe|object|embed|form)\b[^>]*>/gi;

/** 사용자 HTML/CSS에서 위험 요소를 제거합니다 (저장·렌더 공통). */
export function sanitizeHtmlSkinContent(html: string, css: string): { html: string; css: string } {
  let outHtml = html ?? "";
  let outCss = css ?? "";
  outHtml = outHtml.replace(SCRIPT_TAG, "");
  outHtml = outHtml.replace(ON_ATTR, "");
  outHtml = outHtml.replace(JS_URL, "");
  outHtml = outHtml.replace(META_REFRESH, "");
  outHtml = outHtml.replace(BLOCKED_TAGS, "");
  outCss = outCss.replace(SCRIPT_TAG, "");
  outCss = outCss.replace(JS_URL, "");
  return { html: outHtml, css: outCss };
}

export function htmlSkinContentByteLength(html: string, css: string): number {
  const h = html ?? "";
  const c = css ?? "";
  let len = 0;
  for (let i = 0; i < h.length; i += 1) {
    const code = h.charCodeAt(i);
    len += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : 3;
  }
  for (let i = 0; i < c.length; i += 1) {
    const code = c.charCodeAt(i);
    len += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : 3;
  }
  return len;
}

export function assertHtmlSkinContentSize(html: string, css: string, maxBytes: number): void {
  const len = htmlSkinContentByteLength(html, css);
  if (len > maxBytes) {
    throw new Error(`HTML+CSS 합이 ${maxBytes}바이트를 넘을 수 없어요 (현재 ${len})`);
  }
}