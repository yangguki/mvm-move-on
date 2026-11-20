import {
  findFreeSlug,
  parseSkinCreateBody,
  SKIN_NAME_MAX_LENGTH,
  SkinCreateBodyError,
} from "@mvn/shared";
import { first, query, run, stringifyJsonColumn } from "../db";
import type { CloudEnv } from "../env";
import { json, nestConflict, nestError } from "../http";
import {
  buildProgramUsageMap,
  findSkinByIdOrSlug,
  findSkinUsage,
  presentSkinRow,
  previewFromScreen,
  type ScreenRow,
} from "../skins-helpers";

async function deviceCount(db: D1Database, skinId: string): Promise<number> {
  const row = await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM devices WHERE skin_id = ?`, skinId);
  return Number(row?.n ?? 0);
}

async function screenCount(db: D1Database, skinId: string): Promise<number> {
  const row = await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM skin_screens WHERE skin_id = ?`, skinId);
  return Number(row?.n ?? 0);
}

export async function handleSkinsList(_request: Request, env: CloudEnv): Promise<Response> {
  const db = env.DB;
  const rows = await query<
    {
      id: string;
      slug: string;
      name: string;
      description: string | null;
      tone: string;
      thumbnail_url: string | null;
      kind: string;
      tokens: string;
      is_active: number;
      is_builtin: number;
      created_at: string;
    }
  >(db, `SELECT * FROM skins ORDER BY is_builtin DESC, name ASC`);
  const screens = await query<ScreenRow>(
    db,
    `SELECT * FROM skin_screens ORDER BY skin_id ASC, sort_order ASC`,
  );
  const firstScreenBySkin = new Map<string, ScreenRow>();
  for (const screen of screens) {
    if (!firstScreenBySkin.has(screen.skin_id)) firstScreenBySkin.set(screen.skin_id, screen);
  }
  const deviceCounts = await query<{ skin_id: string; n: number }>(
    db,
    `SELECT skin_id, COUNT(*) AS n FROM devices GROUP BY skin_id`,
  );
  const deviceCountMap = new Map(deviceCounts.map((r) => [r.skin_id, Number(r.n)]));
  const screenCounts = await query<{ skin_id: string; n: number }>(
    db,
    `SELECT skin_id, COUNT(*) AS n FROM skin_screens GROUP BY skin_id`,
  );
  const screenCountMap = new Map(screenCounts.map((r) => [r.skin_id, Number(r.n)]));
  const programUsage = await buildProgramUsageMap(db);

  const items = rows.map((row) => {
    const programs = programUsage.get(row.slug) ?? [];
    const first = firstScreenBySkin.get(row.id);
    const previewScreen =
      row.kind === "html" && first ? previewFromScreen(first) : null;
    return {
      ...presentSkinRow({
        ...row,
        device_count: deviceCountMap.get(row.id) ?? 0,
        screen_count: screenCountMap.get(row.id) ?? 0,
      }),
      usedInPrograms: programs,
      programCount: programs.length,
      previewScreen,
    };
  });
  return json({ items });
}

export async function handleSkinDetail(_request: Request, env: CloudEnv, id: string): Promise<Response> {
  const row = await findSkinByIdOrSlug(env.DB, id);
  if (!row) return nestError("스킨을 찾을 수 없어요", 404);
  const programUsage = await buildProgramUsageMap(env.DB);
  return json({
    ...presentSkinRow({
      ...row,
      device_count: await deviceCount(env.DB, row.id),
      screen_count: await screenCount(env.DB, row.id),
    }),
    usedInPrograms: programUsage.get(row.slug) ?? [],
  });
}

export async function handleSkinCreate(request: Request, env: CloudEnv): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return nestError("본문이 필요해요", 400);
  }
  let input;
  try {
    input = parseSkinCreateBody(body);
  } catch (error) {
    if (error instanceof SkinCreateBodyError) return nestError(error.message, 400);
    throw error;
  }
  const slugTaken = async (candidate: string) =>
    !!(await first(env.DB, `SELECT id FROM skins WHERE slug = ?`, candidate));
  let slug = input.slug;
  if (input.slugWasExplicit) {
    if (await slugTaken(slug)) return nestError("이미 같은 slug의 스킨이 있어요", 400);
  } else {
    const occupied = new Set<string>();
    while (true) {
      const candidate = findFreeSlug(input.slug, (s) => occupied.has(s));
      if (!(await slugTaken(candidate))) {
        slug = candidate;
        break;
      }
      occupied.add(candidate);
    }
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const kind = input.kind === "html" ? "html" : "tokens";
  const tokens = stringifyJsonColumn(kind === "html" ? {} : input.tokens ?? {});
  await run(
    env.DB,
    `INSERT INTO skins (id, slug, name, description, tone, thumbnail_url, kind, tokens, is_active, is_builtin, created_at, updated_at, rev)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, 0)`,
    id,
    slug,
    input.name,
    input.description,
    input.tone || "linear-gradient(135deg,#333,#666)",
    input.thumbnailUrl,
    kind,
    tokens,
    now,
    now,
  );
  const row = await findSkinByIdOrSlug(env.DB, id);
  if (!row) return nestError("스킨을 찾을 수 없어요", 404);
  return json(presentSkinRow({ ...row, device_count: 0, screen_count: 0 }));
}

export async function handleSkinUpdate(request: Request, env: CloudEnv, id: string): Promise<Response> {
  const current = await findSkinByIdOrSlug(env.DB, id);
  if (!current) return nestError("스킨을 찾을 수 없어요", 404);
  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return nestError("본문이 필요해요", 400);
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  if (typeof raw.name === "string") {
    const name = raw.name.trim();
    if (!name) return nestError("name이 필요해요", 400);
    if (name.length > SKIN_NAME_MAX_LENGTH) {
      return nestError(`name은 ${SKIN_NAME_MAX_LENGTH}자 이하여야 해요`, 400);
    }
    sets.push("name = ?");
    params.push(name);
  }
  if (typeof raw.description === "string") {
    sets.push("description = ?");
    params.push(raw.description.trim() || null);
  }
  if (typeof raw.tone === "string") {
    sets.push("tone = ?");
    params.push(raw.tone);
  }
  if (typeof raw.thumbnailUrl === "string") {
    sets.push("thumbnail_url = ?");
    params.push(raw.thumbnailUrl || null);
  }
  if (raw.tokens && typeof raw.tokens === "object") {
    sets.push("tokens = ?");
    params.push(stringifyJsonColumn(raw.tokens));
  }
  if (typeof raw.isActive === "boolean") {
    sets.push("is_active = ?");
    params.push(raw.isActive ? 1 : 0);
  }
  if (sets.length === 0) return nestError("변경할 항목이 없어요", 400);
  const now = new Date().toISOString();
  sets.push("updated_at = ?");
  params.push(now);
  params.push(current.id);
  await run(env.DB, `UPDATE skins SET ${sets.join(", ")} WHERE id = ?`, ...params);
  const row = await findSkinByIdOrSlug(env.DB, current.id);
  if (!row) return nestError("스킨을 찾을 수 없어요", 404);
  return json(presentSkinRow({ ...row, device_count: await deviceCount(env.DB, row.id) }));
}

export async function handleSkinDelete(_request: Request, env: CloudEnv, id: string): Promise<Response> {
  const current = await findSkinByIdOrSlug(env.DB, id);
  if (!current) return nestError("스킨을 찾을 수 없어요", 404);
  if (current.is_builtin) {
    return nestConflict({ message: "기본 스킨은 삭제할 수 없어요" });
  }
  const usedIn = await findSkinUsage(env.DB, current.slug);
  const devices = await deviceCount(env.DB, current.id);
  if (usedIn.length > 0 || devices > 0) {
    return nestConflict({
      message: "사용 중인 스킨은 삭제할 수 없어요",
      programs: usedIn,
      deviceCount: devices,
    });
  }
  await run(env.DB, `DELETE FROM skins WHERE id = ?`, current.id);
  return json({ ok: true });
}