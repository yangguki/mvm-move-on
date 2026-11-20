import { collectScreenIds } from "../html-skin/screens";
import type { ProgramItem, ProgramSkin, SkinOptions } from "../program";

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 발행 스냅샷에만 붙는 skin 필드(screens, tokens, music…)를 제외하고 draft 내용만 비교합니다. */
export function draftContentDiffersFromPublished(
  draft: { items: ProgramItem[]; skin: ProgramSkin },
  published: { items: ProgramItem[]; skin: ProgramSkin },
): boolean {
  return draftRepublishContentDiffPaths(draft, published).length > 0;
}

/** draft vs 발행 스냅샷(items·skin 편집 필드) 불일치 경로. */
export function draftRepublishContentDiffPaths(
  draft: { items: ProgramItem[]; skin: ProgramSkin },
  published: { items: ProgramItem[]; skin: ProgramSkin },
): string[] {
  const paths: string[] = [];
  if (!deepEqual(draft.items, published.items)) paths.push("items");
  if (draft.skin.id !== published.skin.id) paths.push("skin.id");
  const draftKind = draft.skin.kind ?? undefined;
  const pubKind = published.skin.kind ?? undefined;
  if (draftKind !== pubKind) paths.push("skin.kind");
  for (const key of Object.keys(draft.skin.options) as (keyof SkinOptions)[]) {
    if (!deepEqual(draft.skin.options[key], published.skin.options[key])) {
      paths.push(`skin.options.${String(key)}`);
    }
  }
  return paths;
}

/** 화면 version 맵을 id 기준으로 비교합니다(키 순서 무시). */
export function screenVersionsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of keys) {
    if (a[id] !== b[id]) return false;
  }
  return true;
}

export function screenVersionsDiffPaths(a: Record<string, number>, b: Record<string, number>): string[] {
  const paths: string[] = [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of keys) {
    if (a[id] !== b[id]) paths.push(`skin.screenVersions.${id}`);
  }
  return paths;
}

/** tokens 스킨만 발행 스냅샷의 skin.tokens 와 비교합니다(html 발행본에는 tokens 없음). */
export function republishSkinTokensDiffPaths(
  skinKind: string | null | undefined,
  liveTokens: Record<string, unknown> | null | undefined,
  publishedTokens: Record<string, unknown> | undefined,
): string[] {
  if (skinKind !== "tokens") return [];
  if (!liveTokens) return [];
  return deepEqual(liveTokens, publishedTokens) ? [] : ["skin.tokens"];
}

export function pickScreenVersionsForItems(
  versions: Record<string, number>,
  items: ProgramItem[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of collectScreenIds(items)) {
    if (id in versions) out[id] = versions[id];
  }
  return out;
}