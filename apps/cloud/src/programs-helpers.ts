import {
  buildHtmlSkinScreensMap,
  collectScreenIds,
  collectVideoRefs,
  presentVideoRow,
  resolveHtmlPublishScreenIds,
  validateHtmlProgramSteps,
  validateProgram,
  type Program as SharedProgram,
  type ProgramItem,
  type SkinPublishMeta,
  type VideoMap,
} from "@mvn/shared";
import { first, parseJsonColumn, query } from "./db";
import { findSkinByIdOrSlug, type ScreenRow } from "./skins-helpers";

export type ProgramDbRow = {
  id: string;
  name: string;
  status: string;
  draft: string;
  draft_updated_at: string;
  published_version: number | null;
  created_at: string;
  updated_at: string;
  rev: number;
};

export function toPresentProgramRow(row: ProgramDbRow) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    draft: parseJsonColumn(row.draft, {}),
    draftUpdatedAt: new Date(row.draft_updated_at),
    publishedVersion: row.published_version,
  };
}

function screenRowToPublishRef(row: ScreenRow) {
  return {
    id: row.id,
    hasVideoSlot: !!row.has_video_slot,
    hasNextVideoSlot: !!row.has_next_video_slot,
    titleOnly: !!row.title_only,
  };
}

function screenRowToFreeze(row: ScreenRow) {
  return {
    id: row.id,
    title: row.title,
    html: row.html,
    css: row.css,
    hasVideoSlot: !!row.has_video_slot,
    hasNextVideoSlot: !!row.has_next_video_slot,
    titleOnly: !!row.title_only,
    version: row.version,
  };
}

export async function loadProgramScreens(db: D1Database, skinId: string): Promise<ScreenRow[]> {
  return query<ScreenRow>(
    db,
    `SELECT * FROM skin_screens WHERE skin_id = ? ORDER BY sort_order ASC`,
    skinId,
  );
}

export async function currentHtmlScreenVersions(db: D1Database, skinUuid: string): Promise<Record<string, number>> {
  const rows = await query<{ id: string; version: number }>(
    db,
    `SELECT id, version FROM skin_screens WHERE skin_id = ?`,
    skinUuid,
  );
  const out: Record<string, number> = {};
  for (const row of rows) out[row.id] = row.version;
  return out;
}

export async function freezeHtmlSkinScreens(db: D1Database, skinId: string, items: ProgramItem[]) {
  const screenIds = collectScreenIds(items);
  const allScreens = await loadProgramScreens(db, skinId);
  const usedIds = resolveHtmlPublishScreenIds(
    screenIds,
    allScreens.map((s) => ({ id: s.id, hasVideoSlot: !!s.has_video_slot })),
  );
  const rows = allScreens.filter((s) => usedIds.has(s.id)).map(screenRowToFreeze);
  return buildHtmlSkinScreensMap(rows);
}

export async function freezeVideos(db: D1Database, items: SharedProgram["items"]): Promise<VideoMap> {
  const refs = collectVideoRefs(items);
  if (!refs.length) return {};
  const ids = [...new Set(refs.map((ref) => ref.videoId))];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await query<{
    id: string;
    name: string;
    url: string;
    duration_sec: number;
    thumbnail_url: string;
    width: number;
    height: number;
  }>(db, `SELECT id, name, url, duration_sec, thumbnail_url, width, height FROM videos WHERE id IN (${placeholders})`, ...ids);
  const byId = new Map(
    rows.map((row) => [
      row.id,
      presentVideoRow({
        id: row.id,
        name: row.name,
        url: row.url,
        durationSec: row.duration_sec,
        thumbnailUrl: row.thumbnail_url,
        width: row.width,
        height: row.height,
      }),
    ]),
  );
  const missing = refs.filter((ref) => !byId.has(ref.videoId));
  if (missing.length) {
    const detail = missing.map((ref) => `${ref.path}(videoId=${ref.videoId})`).join(", ");
    throw new Error(`존재하지 않는 영상이 있어요: ${detail}`);
  }
  const videos: VideoMap = {};
  for (const id of ids) videos[id] = byId.get(id)!;
  return videos;
}

type DraftBody = { items?: unknown; skin?: unknown };

export async function asDraft(
  db: D1Database,
  raw: unknown,
): Promise<{ items: SharedProgram["items"]; skin: SharedProgram["skin"] }> {
  const checked = validateProgram({
    id: "draft",
    name: "tmp",
    status: "draft",
    draftUpdatedAt: new Date().toISOString(),
    publishedVersion: null,
    ...(typeof raw === "object" && raw ? raw : {}),
  });
  const skinRow = await findSkinByIdOrSlug(db, checked.skin.id);
  if (skinRow?.kind === "html") {
    const screenRows = await loadProgramScreens(db, skinRow.id);
    validateHtmlProgramSteps(checked.items, screenRows.map(screenRowToPublishRef), "draft");
    checked.skin.kind = "html";
  } else if (skinRow?.kind === "tokens") {
    checked.skin.kind = "tokens";
  }
  return { items: checked.items, skin: checked.skin };
}

export async function skinMetaForDraft(db: D1Database, draft: unknown): Promise<SkinPublishMeta | null> {
  const skinSlug = (draft as { skin?: { id?: string } })?.skin?.id;
  if (!skinSlug) return null;
  const skinRow = await findSkinByIdOrSlug(db, skinSlug);
  if (!skinRow) return null;
  const screenVersions = skinRow.kind === "html" ? await currentHtmlScreenVersions(db, skinRow.id) : null;
  return {
    tokens: parseJsonColumn<Record<string, unknown>>(skinRow.tokens, {}),
    kind: skinRow.kind,
    screenVersions,
  };
}

export async function getPublishedSnapshot(db: D1Database, programId: string, publishedVersion: number | null) {
  if (publishedVersion == null) return null;
  const version = await first<{ snapshot: string }>(
    db,
    `SELECT snapshot FROM program_versions WHERE program_id = ? AND version = ? LIMIT 1`,
    programId,
    publishedVersion,
  );
  if (!version) return null;
  const snap = parseJsonColumn<{ items: unknown; skin: unknown }>(version.snapshot, { items: [], skin: {} });
  return { items: snap.items, skin: snap.skin };
}

export async function loadProgram(db: D1Database, id: string): Promise<ProgramDbRow | null> {
  return first<ProgramDbRow>(db, `SELECT * FROM programs WHERE id = ? LIMIT 1`, id);
}

export function mergeDraftBody(
  body: { name?: string; draft?: DraftBody; items?: unknown; skin?: unknown },
  current: ProgramDbRow,
): unknown {
  const currentDraft = parseJsonColumn<DraftBody>(current.draft, {});
  const incoming = body.draft ?? { items: body.items, skin: body.skin };
  return {
    name: body.name?.trim() || current.name,
    status: "draft",
    items: incoming.items ?? currentDraft.items,
    skin: incoming.skin ?? currentDraft.skin,
  };
}