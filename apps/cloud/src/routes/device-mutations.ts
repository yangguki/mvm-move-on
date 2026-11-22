import { first, run } from "../db";
import type { CloudEnv } from "../env";
import { json, nestError } from "../http";

type DeviceRow = {
  id: string;
  name: string;
  code: string;
  video_loop_mode: string;
  store_id: string;
  store_name: string;
  store_code: string;
  skin_id: string;
  skin_name: string;
};

export async function handleDeviceUpdate(request: Request, env: CloudEnv, id: string): Promise<Response> {
  const device = await first<{ id: string }>(env.DB, `SELECT id FROM devices WHERE id = ?`, id);
  if (!device) return nestError("TV를 찾을 수 없어요", 404);
  let body: { name?: string; videoLoopMode?: string; storeId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  if (body.videoLoopMode && body.videoLoopMode !== "ab" && body.videoLoopMode !== "single") {
    return nestError("영상 반복은 ab 또는 single 이에요", 400);
  }
  let nameParam: string | null = null;
  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (!trimmed) return nestError("TV 이름을 입력해 주세요", 400);
    nameParam = trimmed;
  }
  let storeIdParam: string | null = null;
  if (body.storeId !== undefined) {
    const store = await first<{ id: string; is_active: number }>(
      env.DB,
      `SELECT id, is_active FROM stores WHERE id = ?`,
      body.storeId,
    );
    if (!store) return nestError("지점을 찾을 수 없어요", 404);
    if (!store.is_active) return nestError("비활성 지점이에요", 400);
    storeIdParam = body.storeId;
  }
  const now = new Date().toISOString();
  await run(
    env.DB,
    `UPDATE devices SET
       name = COALESCE(?, name),
       video_loop_mode = COALESCE(?, video_loop_mode),
       store_id = COALESCE(?, store_id),
       updated_at = ?
     WHERE id = ?`,
    nameParam,
    body.videoLoopMode ?? null,
    storeIdParam,
    now,
    id,
  );
  const updated = await first<DeviceRow>(
    env.DB,
    `SELECT d.id, d.name, d.code, d.video_loop_mode,
            st.id AS store_id, st.name AS store_name, st.code AS store_code,
            sk.id AS skin_id, sk.name AS skin_name
     FROM devices d
     INNER JOIN stores st ON st.id = d.store_id
     INNER JOIN skins sk ON sk.id = d.skin_id
     WHERE d.id = ?`,
    id,
  );
  const row = updated!;
  return json({
    id: row.id,
    name: row.name,
    code: row.code,
    videoLoopMode: row.video_loop_mode,
    store: { id: row.store_id, name: row.store_name, code: row.store_code },
    skin: { id: row.skin_id, name: row.skin_name },
  });
}

export async function handleDeviceDelete(_request: Request, env: CloudEnv, id: string): Promise<Response> {
  const device = await first<{ id: string; code: string }>(env.DB, `SELECT id, code FROM devices WHERE id = ?`, id);
  if (!device) return nestError("TV를 찾을 수 없어요", 404);
  if (device.code === "TV-O8I0" || device.code === "TV-JFEA") {
    return nestError("시드 기기는 삭제할 수 없어요", 409);
  }
  await run(env.DB, `UPDATE pairing_sessions SET device_id = NULL WHERE device_id = ?`, id);
  await run(env.DB, `DELETE FROM devices WHERE id = ?`, id);
  return json({ ok: true });
}