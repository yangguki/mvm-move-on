import {
  expand,
  playTotalSec,
  type Program as SharedProgram,
  type Video,
} from "../program";
import {
  draftRepublishContentDiffPaths,
  pickScreenVersionsForItems,
  republishSkinTokensDiffPaths,
  screenVersionsDiffPaths,
} from "./program-republish";
import { snapshotScreenVersions } from "./html-skin-publish";

export type PresentedProgram = SharedProgram & {
  totals: { seconds: number; stepCount: number };
  needsRepublish: boolean;
  republishDiff?: string[];
};

export type SkinPublishMeta = {
  tokens?: Record<string, unknown> | null;
  kind?: string | null;
  screenVersions?: Record<string, number> | null;
};

export function presentVideoRow(row: {
  id: string;
  name: string;
  url: string;
  durationSec: number;
  thumbnailUrl: string;
  width: number;
  height: number;
}): Video {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    durationSec: row.durationSec,
    thumbnailUrl: row.thumbnailUrl,
    width: row.width,
    height: row.height,
  };
}

export function presentProgram(
  row: {
    id: string;
    name: string;
    status: string;
    draft: unknown;
    draftUpdatedAt: Date;
    publishedVersion: number | null;
  },
  publishedSnapshot?: { items: unknown; skin: unknown } | null,
  skinMeta?: SkinPublishMeta | null,
): PresentedProgram {
  const draft = row.draft as { items: SharedProgram["items"]; skin: SharedProgram["skin"] };
  const program: SharedProgram = {
    id: row.id,
    name: row.name,
    status: row.status === "published" ? "published" : "draft",
    draftUpdatedAt: row.draftUpdatedAt.toISOString(),
    publishedVersion: row.publishedVersion,
    skin: draft.skin,
    items: draft.items,
  };
  const play = expand(program);
  const republishDiff: string[] = [];
  const pubSnap = publishedSnapshot as { items: typeof draft.items; skin: typeof draft.skin } | null | undefined;
  const canCompare = row.publishedVersion != null && pubSnap != null;
  if (canCompare) {
    republishDiff.push(...draftRepublishContentDiffPaths(draft, pubSnap));
    const pubSkin = pubSnap.skin as {
      tokens?: Record<string, unknown>;
      screens?: Record<string, { version?: number }>;
    };
    republishDiff.push(
      ...republishSkinTokensDiffPaths(skinMeta?.kind ?? draft.skin.kind, skinMeta?.tokens, pubSkin?.tokens),
    );
    if (skinMeta?.kind === "html") {
      const pubVersions = snapshotScreenVersions(pubSkin?.screens as never);
      const currentVersions = pickScreenVersionsForItems(skinMeta.screenVersions ?? {}, draft.items);
      republishDiff.push(...screenVersionsDiffPaths(currentVersions, pubVersions));
    }
  }
  const needsRepublish = canCompare && republishDiff.length > 0;
  return {
    ...program,
    totals: { seconds: playTotalSec(play), stepCount: play.length },
    needsRepublish,
    ...(needsRepublish ? { republishDiff } : {}),
  };
}