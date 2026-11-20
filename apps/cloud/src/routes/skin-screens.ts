import {
  assertHtmlSkinContentSize,
  compactSortOrderAssignments,
  duplicateScreenTitle,
  HTML_SKIN_CONTENT_MAX_BYTES,
  neighborSwapIndex,
  parseDefaultDurationSecForCreate,
  parseDefaultDurationSecForUpdate,
  parseForceFlag,
  parseMoveDirection,
  presentSkinScreen,
  programNamesUsingScreen,
  resolveSlotFlagsForCreate,
  resolveSlotFlagsForUpdate,
  sanitizeHtmlSkinContent,
  screenDeleteBlockedMessage,
  SkinScreenInputError,
  SkinScreenOpsError,
} from "@mvn/shared";
import { bumpSkinRevision, first, query, run } from "../db";
import type { CloudEnv } from "../env";
import { json, nestConflict, nestError } from "../http";
import { findSkinByIdOrSlug, loadProgramScreenUsageRows, type ScreenRow } from "../skins-helpers";

function presentScreen(row: ScreenRow) {
  return presentSkinScreen({
    id: row.id,
    skinId: row.skin_id,
    title: row.title,
    html: row.html,
    css: row.css,
    hasVideoSlot: !!row.has_video_slot,
    hasNextVideoSlot: !!row.has_next_video_slot,
    titleOnly: !!row.title_only,
    defaultDurationSec: row.default_duration_sec,
    sortOrder: row.sort_order,
    version: row.version,
    updatedAt: new Date(row.updated_at),
  });
}

async function loadHtmlSkin(
  env: CloudEnv,
  skinId: string,
): Promise<{ skin: NonNullable<Awaited<ReturnType<typeof findSkinByIdOrSlug>>> } | { error: Response }> {
  const skin = await findSkinByIdOrSlug(env.DB, skinId);
  if (!skin) return { error: nestError("스킨을 찾을 수 없어요", 404) };
  if (skin.kind !== "html") return { error: nestError("HTML 스킨만 화면을 편집할 수 있어요", 400) };
  return { skin };
}

function parseContent(raw: { html?: unknown; css?: unknown }) {
  const html = typeof raw.html === "string" ? raw.html : "";
  const css = typeof raw.css === "string" ? raw.css : "";
  const cleaned = sanitizeHtmlSkinContent(html, css);
  assertHtmlSkinContentSize(cleaned.html, cleaned.css, HTML_SKIN_CONTENT_MAX_BYTES);
  return cleaned;
}

export async function handleScreensList(_request: Request, env: CloudEnv, skinId: string): Promise<Response> {
  const loaded = await loadHtmlSkin(env, skinId);
  if ("error" in loaded) return loaded.error;
  const rows = await query<ScreenRow>(
    env.DB,
    `SELECT * FROM skin_screens WHERE skin_id = ? ORDER BY sort_order ASC`,
    loaded.skin.id,
  );
  return json({ items: rows.map(presentScreen) });
}

export async function handleScreenGetOne(
  _request: Request,
  env: CloudEnv,
  skinId: string,
  screenId: string,
): Promise<Response> {
  const loaded = await loadHtmlSkin(env, skinId);
  if ("error" in loaded) return loaded.error;
  const row = await first<ScreenRow>(
    env.DB,
    `SELECT * FROM skin_screens WHERE id = ? AND skin_id = ?`,
    screenId,
    loaded.skin.id,
  );
  if (!row) return nestError("화면을 찾을 수 없어요", 404);
  return json(presentScreen(row));
}

export async function handleScreenUsage(
  _request: Request,
  env: CloudEnv,
  skinId: string,
  screenId: string,
): Promise<Response> {
  const loaded = await loadHtmlSkin(env, skinId);
  if ("error" in loaded) return loaded.error;
  const row = await first<ScreenRow>(
    env.DB,
    `SELECT * FROM skin_screens WHERE id = ? AND skin_id = ?`,
    screenId,
    loaded.skin.id,
  );
  if (!row) return nestError("화면을 찾을 수 없어요", 404);
  const programs = programNamesUsingScreen(await loadProgramScreenUsageRows(env.DB), row.id);
  return json({ programs });
}

export async function handleScreenCreate(request: Request, env: CloudEnv, skinId: string): Promise<Response> {
  const loaded = await loadHtmlSkin(env, skinId);
  if ("error" in loaded) return loaded.error;
  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return nestError("본문이 필요해요", 400);
  }
  if (!raw || typeof raw !== "object") return nestError("본문이 필요해요", 400);
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return nestError("화면 제목이 필요해요", 400);
  let slotFlags;
  try {
    slotFlags = resolveSlotFlagsForCreate(raw);
  } catch (error) {
    if (error instanceof SkinScreenInputError) return nestError(error.message, 400);
    throw error;
  }
  let defaultDurationSec;
  try {
    defaultDurationSec = parseDefaultDurationSecForCreate(raw.defaultDurationSec);
  } catch (error) {
    if (error instanceof SkinScreenInputError) return nestError(error.message, 400);
    throw error;
  }
  let cleaned;
  try {
    cleaned = parseContent(raw);
  } catch (error) {
    if (error instanceof Error) return nestError(error.message, 400);
    throw error;
  }
  const maxRow = await first<{ m: number | null }>(
    env.DB,
    `SELECT MAX(sort_order) AS m FROM skin_screens WHERE skin_id = ?`,
    loaded.skin.id,
  );
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sortOrder = (maxRow?.m ?? -1) + 1;
  await run(
    env.DB,
    `INSERT INTO skin_screens (id, skin_id, title, html, css, has_video_slot, has_next_video_slot, title_only,
     default_duration_sec, sort_order, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id,
    loaded.skin.id,
    title,
    cleaned.html,
    cleaned.css,
    slotFlags.hasVideoSlot ? 1 : 0,
    slotFlags.hasNextVideoSlot ? 1 : 0,
    slotFlags.titleOnly ? 1 : 0,
    defaultDurationSec,
    sortOrder,
    now,
    now,
  );
  await bumpSkinRevision(env.DB, loaded.skin.id);
  const row = await first<ScreenRow>(env.DB, `SELECT * FROM skin_screens WHERE id = ?`, id);
  return json(presentScreen(row!));
}

export async function handleScreenDuplicate(
  _request: Request,
  env: CloudEnv,
  skinId: string,
  screenId: string,
): Promise<Response> {
  const loaded = await loadHtmlSkin(env, skinId);
  if ("error" in loaded) return loaded.error;
  const source = await first<ScreenRow>(
    env.DB,
    `SELECT * FROM skin_screens WHERE id = ? AND skin_id = ?`,
    screenId,
    loaded.skin.id,
  );
  if (!source) return nestError("화면을 찾을 수 없어요", 404);
  const insertOrder = source.sort_order + 1;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(
    env.DB,
    `UPDATE skin_screens SET sort_order = sort_order + 1 WHERE skin_id = ? AND sort_order >= ?`,
    loaded.skin.id,
    insertOrder,
  );
  await run(
    env.DB,
    `INSERT INTO skin_screens (id, skin_id, title, html, css, has_video_slot, has_next_video_slot, title_only,
     default_duration_sec, sort_order, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id,
    loaded.skin.id,
    duplicateScreenTitle(source.title),
    source.html,
    source.css,
    source.has_video_slot,
    source.has_next_video_slot,
    source.title_only,
    source.default_duration_sec,
    insertOrder,
    now,
    now,
  );
  await bumpSkinRevision(env.DB, loaded.skin.id);
  const row = await first<ScreenRow>(env.DB, `SELECT * FROM skin_screens WHERE id = ?`, id);
  return json(presentScreen(row!));
}

export async function handleScreenMove(
  request: Request,
  env: CloudEnv,
  skinId: string,
  screenId: string,
): Promise<Response> {
  const loaded = await loadHtmlSkin(env, skinId);
  if ("error" in loaded) return loaded.error;
  const current = await first<ScreenRow>(
    env.DB,
    `SELECT * FROM skin_screens WHERE id = ? AND skin_id = ?`,
    screenId,
    loaded.skin.id,
  );
  if (!current) return nestError("화면을 찾을 수 없어요", 404);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return nestError("본문이 필요해요", 400);
  }
  if (!body || typeof body !== "object") return nestError("본문이 필요해요", 400);
  let direction;
  try {
    direction = parseMoveDirection((body as { direction?: unknown }).direction);
  } catch (error) {
    if (error instanceof SkinScreenOpsError) return nestError(error.message, 400);
    throw error;
  }
  const rows = await query<{ id: string; sort_order: number }>(
    env.DB,
    `SELECT id, sort_order FROM skin_screens WHERE skin_id = ? ORDER BY sort_order ASC`,
    loaded.skin.id,
  );
  const sortedIds = rows.map((r) => r.id);
  const swapIdx = neighborSwapIndex(sortedIds, current.id, direction);
  if (swapIdx === null) return json(presentScreen(current));
  const other = rows[swapIdx]!;
  await run(env.DB, `UPDATE skin_screens SET sort_order = ? WHERE id = ?`, other.sort_order, current.id);
  await run(env.DB, `UPDATE skin_screens SET sort_order = ? WHERE id = ?`, current.sort_order, other.id);
  await bumpSkinRevision(env.DB, loaded.skin.id);
  const updated = await first<ScreenRow>(env.DB, `SELECT * FROM skin_screens WHERE id = ?`, current.id);
  return json(presentScreen(updated!));
}

export async function handleScreenUpdate(
  request: Request,
  env: CloudEnv,
  skinId: string,
  screenId: string,
): Promise<Response> {
  const loaded = await loadHtmlSkin(env, skinId);
  if ("error" in loaded) return loaded.error;
  const current = await first<ScreenRow>(
    env.DB,
    `SELECT * FROM skin_screens WHERE id = ? AND skin_id = ?`,
    screenId,
    loaded.skin.id,
  );
  if (!current) return nestError("화면을 찾을 수 없어요", 404);
  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return nestError("본문이 필요해요", 400);
  }
  if (!raw || typeof raw !== "object") return nestError("본문이 필요해요", 400);
  const sets: string[] = ["version = version + 1"];
  const params: unknown[] = [];
  if (typeof raw.title === "string" && raw.title.trim()) {
    sets.push("title = ?");
    params.push(raw.title.trim());
  }
  if (raw.html !== undefined || raw.css !== undefined) {
    try {
      const cleaned = parseContent({
        html: raw.html !== undefined ? raw.html : current.html,
        css: raw.css !== undefined ? raw.css : current.css,
      });
      sets.push("html = ?", "css = ?");
      params.push(cleaned.html, cleaned.css);
    } catch (error) {
      if (error instanceof Error) return nestError(error.message, 400);
      throw error;
    }
  }
  try {
    const slotUpdate = resolveSlotFlagsForUpdate(raw);
    if (slotUpdate?.mode === "slotType") {
      sets.push("has_video_slot = ?", "has_next_video_slot = ?", "title_only = ?");
      params.push(
        slotUpdate.flags.hasVideoSlot ? 1 : 0,
        slotUpdate.flags.hasNextVideoSlot ? 1 : 0,
        slotUpdate.flags.titleOnly ? 1 : 0,
      );
    } else if (slotUpdate?.mode === "booleans") {
      if (slotUpdate.patch.hasVideoSlot !== undefined) {
        sets.push("has_video_slot = ?");
        params.push(slotUpdate.patch.hasVideoSlot ? 1 : 0);
      }
      if (slotUpdate.patch.hasNextVideoSlot !== undefined) {
        sets.push("has_next_video_slot = ?");
        params.push(slotUpdate.patch.hasNextVideoSlot ? 1 : 0);
      }
      if (slotUpdate.patch.titleOnly !== undefined) {
        sets.push("title_only = ?");
        params.push(slotUpdate.patch.titleOnly ? 1 : 0);
      }
    }
    const defaultDurationSec = parseDefaultDurationSecForUpdate(raw.defaultDurationSec);
    if (defaultDurationSec !== undefined) {
      sets.push("default_duration_sec = ?");
      params.push(defaultDurationSec);
    }
  } catch (error) {
    if (error instanceof SkinScreenInputError) return nestError(error.message, 400);
    throw error;
  }
  if (typeof raw.sortOrder === "number" && Number.isInteger(raw.sortOrder)) {
    sets.push("sort_order = ?");
    params.push(raw.sortOrder);
  }
  const now = new Date().toISOString();
  sets.push("updated_at = ?");
  params.push(now);
  params.push(current.id);
  await run(env.DB, `UPDATE skin_screens SET ${sets.join(", ")} WHERE id = ?`, ...params);
  await bumpSkinRevision(env.DB, loaded.skin.id);
  const row = await first<ScreenRow>(env.DB, `SELECT * FROM skin_screens WHERE id = ?`, current.id);
  return json(presentScreen(row!));
}

export async function handleScreenDelete(
  request: Request,
  env: CloudEnv,
  skinId: string,
  screenId: string,
): Promise<Response> {
  const loaded = await loadHtmlSkin(env, skinId);
  if ("error" in loaded) return loaded.error;
  const current = await first<ScreenRow>(
    env.DB,
    `SELECT * FROM skin_screens WHERE id = ? AND skin_id = ?`,
    screenId,
    loaded.skin.id,
  );
  if (!current) return nestError("화면을 찾을 수 없어요", 404);
  const url = new URL(request.url);
  const force = url.searchParams.get("force") ?? undefined;
  const programs = programNamesUsingScreen(await loadProgramScreenUsageRows(env.DB), current.id);
  const blocked = screenDeleteBlockedMessage(programs);
  if (blocked && !parseForceFlag(force)) {
    return nestConflict({ message: blocked, programs });
  }
  await run(env.DB, `DELETE FROM skin_screens WHERE id = ?`, current.id);
  const remaining = await query<{ id: string; sort_order: number }>(
    env.DB,
    `SELECT id, sort_order FROM skin_screens WHERE skin_id = ?`,
    loaded.skin.id,
  );
  const assignments = compactSortOrderAssignments(
    remaining.map((r) => ({ id: r.id, sortOrder: r.sort_order })),
  );
  for (const { id, sortOrder } of assignments) {
    await run(env.DB, `UPDATE skin_screens SET sort_order = ? WHERE id = ?`, sortOrder, id);
  }
  await bumpSkinRevision(env.DB, loaded.skin.id);
  return json({ ok: true });
}

export async function handleScreensReorder(
  request: Request,
  env: CloudEnv,
  skinId: string,
): Promise<Response> {
  const loaded = await loadHtmlSkin(env, skinId);
  if ("error" in loaded) return loaded.error;
  let body: { order?: string[] };
  try {
    body = (await request.json()) as { order?: string[] };
  } catch {
    return nestError("본문이 필요해요", 400);
  }
  const order = body?.order;
  if (!Array.isArray(order) || !order.length) return nestError("order 배열이 필요해요", 400);
  for (let sortOrder = 0; sortOrder < order.length; sortOrder++) {
    await run(
      env.DB,
      `UPDATE skin_screens SET sort_order = ? WHERE id = ? AND skin_id = ?`,
      sortOrder,
      order[sortOrder],
      loaded.skin.id,
    );
  }
  await bumpSkinRevision(env.DB, loaded.skin.id);
  const rows = await query<ScreenRow>(
    env.DB,
    `SELECT * FROM skin_screens WHERE skin_id = ? ORDER BY sort_order ASC`,
    loaded.skin.id,
  );
  return json({ items: rows.map(presentScreen) });
}