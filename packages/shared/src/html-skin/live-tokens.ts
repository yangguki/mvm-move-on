import type { HtmlSkinTokenMap } from "./tokens";

const TOKEN_RE = /\{\{([^{}]+)\}\}/g;

function tokenText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

/** 런타임 첫 치환: {{key}} → live span (srcdoc postMessage 갱신용) */
export function markHtmlSkinLiveTokens(html: string, tokens: HtmlSkinTokenMap): string {
  return html.replace(TOKEN_RE, (_, key: string) => {
    const k = String(key).trim();
    const v = tokenText(tokens[k]);
    return `<span data-mvn-token="${k}">${v}</span>`;
  });
}

/** 이미 mark된 HTML에서 span 값만 갱신 */
export function refreshHtmlSkinLiveTokens(html: string, tokens: HtmlSkinTokenMap): string {
  return html.replace(/<span data-mvn-token="([^"]+)">([\s\S]*?)<\/span>/g, (full, rawKey: string) => {
    const key = String(rawKey).trim();
    const v = tokenText(tokens[key]);
    return `<span data-mvn-token="${key}">${v}</span>`;
  });
}

export function htmlSkinLiveTokensHasMarkers(html: string): boolean {
  return html.includes("data-mvn-token=");
}