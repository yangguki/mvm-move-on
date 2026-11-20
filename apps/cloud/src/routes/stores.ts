import { storeConnectivityState } from "@mvn/shared";
import { assertHq } from "../auth/assert-hq";
import { resolveAuth } from "../auth/session";
import { first, query, run } from "../db";
import type { CloudEnv } from "../env";
import { json, nestConflict, nestError } from "../http";
import { storeProgramAssignBlockedMessage } from "../store-program-assign";

type StoreRow = {
  id: string;
  name: string;
  code: string;
  is_active: number;
  program_id: string | null;
};

type DeviceSkinRow = {
  id: string;
  store_id: string;
  status: string;
  playing: string | null;
  offline: number;
  skin_id: string;
  skin_name: string;
  skin_tone: string;
};

function isUnique(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export async function handleStoresList(_request: Request, env: CloudEnv): Promise<Response> {
  const stores = await query<StoreRow>(env.DB, `SELECT * FROM stores ORDER BY name ASC`);
  const devices = await query<DeviceSkinRow>(
    env.DB,
  `SELECT d.id, d.store_id, d.status, d.playing, d.offline, d.skin_id, s.name AS skin_name, s.tone AS skin_tone
   FROM devices d INNER JOIN skins s ON s.id = d.skin_id`,
  );
  const programIds = [...new Set(stores.map((s) => s.program_id).filter(Boolean))] as string[];
  const programMap = new Map<string, { id: string; name: string }>();
  if (programIds.length) {
    const programs = await query<{ id: string; name: string }>(
      env.DB,
      `SELECT id, name FROM programs WHERE id IN (${programIds.map(() => "?").join(",")})`,
      ...programIds,
    );
    for (const p of programs) programMap.set(p.id, p);
  }

  const byStore = new Map<string, DeviceSkinRow[]>();
  for (const d of devices) {
    const list = byStore.get(d.store_id) ?? [];
    list.push(d);
    byStore.set(d.store_id, list);
  }

  const items = stores.map((store) => {
    const devs = byStore.get(store.id) ?? [];
    const online = devs.filter((d) => !d.offline).length;
    const offline = devs.length - online;
    const skin = devs[0] ?? null;
    const playing = devs.find((d) => d.status === "ok")?.playing ?? null;
    const state = storeConnectivityState(offline, devs.length);
    const program = store.program_id ? programMap.get(store.program_id) ?? null : null;
    return {
      id: store.id,
      name: store.name,
      code: store.code,
      isActive: !!store.is_active,
      tvCount: devs.length,
      online,
      offline,
      programName: playing,
      program: program ? { id: program.id, name: program.name } : null,
      skin: skin ? { id: skin.skin_id, name: skin.skin_name, tone: skin.skin_tone } : null,
      state,
    };
  });

  return json({
    summary: {
      storeCount: items.length,
      tvCount: items.reduce((sum, store) => sum + store.tvCount, 0),
    },
    items,
  });
}

export async function handleStoreCreate(request: Request, env: CloudEnv): Promise<Response> {
  const user = await resolveAuth(request, env.SESSION_SECRET);
  if (!user) return nestError("로그인이 필요해요", 401);
  const forbidden = assertHq(user);
  if (forbidden) return forbidden;
  let body: { name?: string; code?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const name = body.name?.trim() ?? "";
  const code = body.code?.trim().toUpperCase() ?? "";
  if (!name || !code) return nestError("지점 이름과 코드가 필요해요", 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await run(
      env.DB,
      `INSERT INTO stores (id, name, code, is_active, program_id, created_at, updated_at) VALUES (?, ?, ?, 1, NULL, ?, ?)`,
      id,
      name,
      code,
      now,
      now,
    );
  } catch (error) {
    if (isUnique(error)) return nestError("이미 있는 지점 코드예요", 409);
    throw error;
  }
  return json({
    id,
    name,
    code,
    tvCount: 0,
    online: 0,
    offline: 0,
    programName: null,
    skin: null,
    state: "ok",
  });
}

export async function handleStoreUpdate(request: Request, env: CloudEnv, id: string): Promise<Response> {
  const user = await resolveAuth(request, env.SESSION_SECRET);
  if (!user) return nestError("로그인이 필요해요", 401);
  const forbidden = assertHq(user);
  if (forbidden) return forbidden;
  const store = await first<StoreRow>(env.DB, `SELECT * FROM stores WHERE id = ?`, id);
  if (!store) return nestError("지점을 찾을 수 없어요", 404);
  let body: { name?: string; isActive?: boolean; programId?: string | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name !== undefined && !name) return nestError("지점 이름이 필요해요", 400);
  let programId: string | null | undefined = undefined;
  if (body.programId !== undefined) {
    if (body.programId === null) {
      programId = null;
    } else if (typeof body.programId === "string") {
      const program = await first<{ id: string; published_version: number | null }>(
        env.DB,
        `SELECT id, published_version FROM programs WHERE id = ?`,
        body.programId,
      );
      if (!program) return nestError("프로그램을 찾을 수 없어요", 404);
      const blocked = storeProgramAssignBlockedMessage(program.published_version);
      if (blocked) return nestError(blocked, 400);
      programId = body.programId;
    }
  }
  const now = new Date().toISOString();
  const nextName = name ?? store.name;
  const nextActive = typeof body.isActive === "boolean" ? (body.isActive ? 1 : 0) : store.is_active;
  const nextProgramId = programId !== undefined ? programId : store.program_id;
  await run(
    env.DB,
    `UPDATE stores SET name = ?, is_active = ?, program_id = ?, updated_at = ? WHERE id = ?`,
    nextName,
    nextActive,
    nextProgramId,
    now,
    id,
  );
  const program = nextProgramId ? await first<{ id: string; name: string }>(env.DB, `SELECT id, name FROM programs WHERE id = ?`, nextProgramId) : null;
  return json({
    id,
    name: nextName,
    code: store.code,
    isActive: !!nextActive,
    programId: nextProgramId,
    program: program ? { id: program.id, name: program.name } : null,
  });
}

export async function handleStoreDelete(_request: Request, env: CloudEnv, id: string): Promise<Response> {
  const user = await resolveAuth(_request, env.SESSION_SECRET);
  if (!user) return nestError("로그인이 필요해요", 401);
  const forbidden = assertHq(user);
  if (forbidden) return forbidden;
  const store = await first<StoreRow>(env.DB, `SELECT * FROM stores WHERE id = ?`, id);
  if (!store) return nestError("지점을 찾을 수 없어요", 404);
  const deviceCount = await first<{ n: number }>(env.DB, `SELECT COUNT(*) AS n FROM devices WHERE store_id = ?`, id);
  if ((deviceCount?.n ?? 0) > 0) {
    return nestConflict({
      message: "연결된 TV가 있어 삭제할 수 없어요. 먼저 비활성화하세요.",
      deviceCount: deviceCount?.n ?? 0,
    });
  }
  if (store.program_id) {
    return nestConflict({
      message: "지정된 프로그램이 있어 삭제할 수 없어요. 먼저 프로그램 지정을 해제하세요.",
      programId: store.program_id,
    });
  }
  await run(env.DB, `DELETE FROM stores WHERE id = ?`, id);
  return json({ ok: true });
}