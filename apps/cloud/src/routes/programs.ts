import {
  collectMissingHtmlProgramScreens,
  collectMissingPublishVideos,
  expand,
  missingPublishScreensMessage,
  missingPublishVideosMessage,
  presentProgram,
  programDeleteBlockedMessage,
  type Program as SharedProgram,
  type PublishedSnapshot,
  type SkinPublishMeta,
  validateHtmlProgramSteps,
  validateProgram,
} from "@mvn/shared";
import { first, parseJsonColumn, query, run, stringifyJsonColumn, updateWithRev } from "../db";
import type { CloudEnv } from "../env";
import { json, nestConflict, nestError } from "../http";
import {
  asDraft,
  currentHtmlScreenVersions,
  freezeHtmlSkinScreens,
  freezeVideos,
  getPublishedSnapshot,
  loadProgram,
  loadProgramScreens,
  mergeDraftBody,
  skinMetaForDraft,
  toPresentProgramRow,
  type ProgramDbRow,
} from "../programs-helpers";
import { findSkinByIdOrSlug } from "../skins-helpers";

async function skinMetaMapForPrograms(db: D1Database, rows: ProgramDbRow[]): Promise<Map<string, SkinPublishMeta>> {
  const skinSlugs = [
    ...new Set(
      rows
        .map((r) => parseJsonColumn<{ skin?: { id?: string } }>(r.draft, {}).skin?.id)
        .filter(Boolean) as string[],
    ),
  ];
  const map = new Map<string, SkinPublishMeta>();
  for (const slug of skinSlugs) {
    const skinRow = await findSkinByIdOrSlug(db, slug);
    if (!skinRow) continue;
    const screenVersions = skinRow.kind === "html" ? await currentHtmlScreenVersions(db, skinRow.id) : null;
    map.set(slug, {
      tokens: parseJsonColumn<Record<string, unknown>>(skinRow.tokens, {}),
      kind: skinRow.kind,
      screenVersions,
    });
  }
  return map;
}

async function publishedSnapshotMap(db: D1Database, rows: ProgramDbRow[]) {
  const withPublished = rows.filter((r) => r.published_version != null);
  if (!withPublished.length) return new Map<string, { items: unknown; skin: unknown }>();
  const versions = await query<{ program_id: string; snapshot: string }>(
    db,
    `SELECT program_id, snapshot FROM program_versions WHERE ${withPublished.map(() => "(program_id = ? AND version = ?)").join(" OR ")}`,
    ...withPublished.flatMap((p) => [p.id, p.published_version!]),
  );
  const map = new Map<string, { items: unknown; skin: unknown }>();
  for (const v of versions) {
    const snap = parseJsonColumn<{ items: unknown; skin: { options: unknown } }>(v.snapshot, { items: [], skin: { options: {} } });
    map.set(v.program_id, { items: snap.items, skin: snap.skin });
  }
  return map;
}

function withProgramRev<T extends object>(presented: T, row: ProgramDbRow | null | undefined) {
  return row ? { ...presented, rev: row.rev } : presented;
}

export async function handleProgramsList(_request: Request, env: CloudEnv): Promise<Response> {
  const rows = await query<ProgramDbRow>(env.DB, `SELECT * FROM programs ORDER BY updated_at DESC`);
  const snapshotMap = await publishedSnapshotMap(env.DB, rows);
  const skinMetaMap = await skinMetaMapForPrograms(env.DB, rows);
  const items = rows.map((r) => {
    const skinSlug = parseJsonColumn<{ skin?: { id?: string } }>(r.draft, {}).skin?.id;
    const skinMeta = skinSlug ? skinMetaMap.get(skinSlug) ?? null : null;
    return presentProgram(toPresentProgramRow(r), snapshotMap.get(r.id), skinMeta);
  });
  return json({ items });
}

export async function handleProgramCreate(request: Request, env: CloudEnv): Promise<Response> {
  let body: { name?: string; draft?: { items?: unknown; skin?: unknown } } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const name = body.name?.trim() ?? "";
  if (!name) return nestError("프로그램 이름이 필요해요", 400);
  let draft;
  try {
    draft = await asDraft(env.DB, {
      name,
      status: "draft",
      items: body.draft?.items ?? [{ id: "guide-1", type: "guide", durationSec: 10, label: "시작 카운트다운" }],
      skin: body.draft?.skin ?? {
        id: "neon-arcade",
        options: { pointColor: "#C8F31D", nextLeadSec: 10 },
      },
    });
  } catch (error) {
    return nestError(error instanceof Error ? error.message : "프로그램 draft가 올바르지 않아요", 400);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(
    env.DB,
    `INSERT INTO programs (id, name, status, draft, draft_updated_at, published_version, created_at, updated_at, rev)
     VALUES (?, ?, 'draft', ?, ?, NULL, ?, ?, 0)`,
    id,
    name,
    stringifyJsonColumn(draft),
    now,
    now,
    now,
  );
  const row = await loadProgram(env.DB, id);
  return json(withProgramRev(presentProgram(toPresentProgramRow(row!), null), row), 201);
}

export async function handleProgramGet(_request: Request, env: CloudEnv, id: string): Promise<Response> {
  const row = await loadProgram(env.DB, id);
  if (!row) return nestError("프로그램을 찾을 수 없어요", 404);
  const published = await getPublishedSnapshot(env.DB, row.id, row.published_version);
  const skinMeta = await skinMetaForDraft(env.DB, parseJsonColumn(row.draft, {}));
  return json(withProgramRev(presentProgram(toPresentProgramRow(row), published, skinMeta), row));
}

export async function handleProgramSave(request: Request, env: CloudEnv, id: string): Promise<Response> {
  const current = await loadProgram(env.DB, id);
  if (!current) return nestError("프로그램을 찾을 수 없어요", 404);
  let body: {
    name?: string;
    draft?: { items?: unknown; skin?: unknown };
    items?: unknown;
    skin?: unknown;
    rev?: number;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  let draft;
  try {
    draft = await asDraft(env.DB, mergeDraftBody(body, current));
  } catch (error) {
    return nestError(error instanceof Error ? error.message : "프로그램 draft가 올바르지 않아요", 400);
  }
  const name = body.name?.trim() || current.name;
  const now = new Date().toISOString();
  const draftJson = stringifyJsonColumn(draft);
  if (typeof body.rev === "number") {
    const locked = await updateWithRev(
      env,
      "programs",
      id,
      body.rev,
      "name = ?, status = 'draft', draft = ?, draft_updated_at = ?",
      [name, draftJson, now],
    );
    if (!locked.ok) {
      if (locked.reason === "not_found") return nestError("프로그램을 찾을 수 없어요", 404);
      return nestConflict({ message: "다른 곳에서 변경됨, 새로고침 필요" });
    }
  } else {
    await run(
      env.DB,
      `UPDATE programs SET name = ?, status = 'draft', draft = ?, draft_updated_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ?`,
      name,
      draftJson,
      now,
      now,
      id,
    );
  }
  const row = await loadProgram(env.DB, id);
  const published = await getPublishedSnapshot(env.DB, row!.id, row!.published_version);
  const skinMeta = await skinMetaForDraft(env.DB, parseJsonColumn(row!.draft, {}));
  return json(withProgramRev(presentProgram(toPresentProgramRow(row!), published, skinMeta), row));
}

export async function handleProgramPublish(_request: Request, env: CloudEnv, id: string): Promise<Response> {
  const current = await loadProgram(env.DB, id);
  if (!current) return nestError("프로그램을 찾을 수 없어요", 404);
  const draft = parseJsonColumn<{ items: SharedProgram["items"]; skin: SharedProgram["skin"] }>(
    current.draft,
    { items: [], skin: { id: "neon-arcade", options: { pointColor: "#C8F31D", nextLeadSec: 10 } } },
  );
  const nextVersion = (current.published_version ?? 0) + 1;
  const skinRow = await findSkinByIdOrSlug(env.DB, draft.skin.id);
  const skinKind = skinRow?.kind ?? "tokens";
  const skinTokens = skinRow && skinKind === "tokens" ? parseJsonColumn<Record<string, unknown>>(skinRow.tokens, {}) : {};
  const screenRows = skinRow && skinKind === "html" ? await loadProgramScreens(env.DB, skinRow.id) : [];
  const publishScreenRefs = screenRows.map((s) => ({
    id: s.id,
    hasVideoSlot: !!s.has_video_slot,
    hasNextVideoSlot: !!s.has_next_video_slot,
    titleOnly: !!s.title_only,
  }));
  const missingVideos = collectMissingPublishVideos(draft.items, { skinKind, screens: publishScreenRefs });
  const missingMessage = missingPublishVideosMessage(missingVideos);
  if (missingMessage) return nestError(missingMessage, 400);
  if (skinKind === "html") {
    const missingScreens = collectMissingHtmlProgramScreens(draft.items, publishScreenRefs);
    const missingScreensMsg = missingPublishScreensMessage(missingScreens);
    if (missingScreensMsg) return nestError(missingScreensMsg, 400);
    try {
      validateHtmlProgramSteps(draft.items, publishScreenRefs, "publish");
    } catch (error) {
      return nestError(error instanceof Error ? error.message : "프로그램 draft가 올바르지 않아요", 400);
    }
  }
  let screens;
  let videos;
  try {
    screens =
      skinRow && skinKind === "html" ? await freezeHtmlSkinScreens(env.DB, skinRow.id, draft.items) : undefined;
    videos = await freezeVideos(env.DB, draft.items);
  } catch (error) {
    return nestError(error instanceof Error ? error.message : "프로그램 draft가 올바르지 않아요", 400);
  }
  const skin = {
    ...draft.skin,
    kind: skinKind as "html" | "tokens",
    tokens: skinKind === "tokens" ? skinTokens : undefined,
    screens,
  };
  let base;
  try {
    base = validateProgram({
      id: current.id,
      name: current.name,
      status: "published",
      draftUpdatedAt: current.draft_updated_at,
      publishedVersion: nextVersion,
      skin,
      items: draft.items,
    });
  } catch (error) {
    return nestError(error instanceof Error ? error.message : "프로그램 draft가 올바르지 않아요", 400);
  }
  const snapshot: PublishedSnapshot = { ...base, videos };
  const versionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const snapshotJson = stringifyJsonColumn(snapshot);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO program_versions (id, program_id, version, published_at, snapshot) VALUES (?, ?, ?, ?, ?)`,
    ).bind(versionId, id, nextVersion, now, snapshotJson),
    env.DB.prepare(
      `UPDATE programs SET status = 'published', published_version = ?, updated_at = ? WHERE id = ?`,
    ).bind(nextVersion, now, id),
  ]);
  const row = await loadProgram(env.DB, id);
  const published = await getPublishedSnapshot(env.DB, row!.id, row!.published_version);
  return json(presentProgram(toPresentProgramRow(row!), published));
}

export async function handleProgramVersions(_request: Request, env: CloudEnv, id: string): Promise<Response> {
  const program = await loadProgram(env.DB, id);
  if (!program) return nestError("프로그램을 찾을 수 없어요", 404);
  const rows = await query<{ id: string; version: number; published_at: string; snapshot: string }>(
    env.DB,
    `SELECT id, version, published_at, snapshot FROM program_versions WHERE program_id = ? ORDER BY version DESC`,
    id,
  );
  return json({
    items: rows.map((version) => {
      const snap = parseJsonColumn<PublishedSnapshot>(version.snapshot, {} as PublishedSnapshot);
      return {
        id: version.id,
        version: version.version,
        name: snap.name,
        publishedAt: version.published_at,
        stepCount: expand(snap, snap.videos ?? {}).length,
        skin: snap.skin,
      };
    }),
  });
}

export async function handleProgramDelete(_request: Request, env: CloudEnv, id: string): Promise<Response> {
  const current = await loadProgram(env.DB, id);
  if (!current) return nestError("프로그램을 찾을 수 없어요", 404);
  const storeRow = await first<{ n: number }>(env.DB, `SELECT COUNT(*) AS n FROM stores WHERE program_id = ?`, id);
  const blocked = programDeleteBlockedMessage(Number(storeRow?.n ?? 0));
  if (blocked) return nestConflict({ message: blocked });
  await run(env.DB, `DELETE FROM program_versions WHERE program_id = ?`, id);
  await run(env.DB, `DELETE FROM programs WHERE id = ?`, id);
  return json({ ok: true });
}