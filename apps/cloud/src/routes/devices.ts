import { deviceListSummaryFromGroupBy } from "@mvn/shared";
import { first, query, run } from "../db";
import type { CloudEnv } from "../env";
import { json, nestError } from "../http";

type DeviceRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  status_label: string;
  playing: string | null;
  progress: number | null;
  app_version: string;
  version_warn: number;
  seen_label: string;
  seen_alert: number;
  guide: number;
  offline: number;
  video_loop_mode: string;
  store_id: string;
  store_name: string;
  store_code: string;
  skin_id: string;
  skin_name: string;
  skin_tone: string;
};

function presentDevice(row: DeviceRow) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    store: { id: row.store_id, name: row.store_name, code: row.store_code },
    status: row.status,
    statusLabel: row.status_label,
    playing: row.playing,
    progress: row.progress,
    skin: { id: row.skin_id, name: row.skin_name, tone: row.skin_tone },
    appVersion: row.app_version,
    versionWarn: !!row.version_warn,
    seenLabel: row.seen_label,
    seenAlert: !!row.seen_alert,
    guide: !!row.guide,
    offline: !!row.offline,
    videoLoopMode: row.video_loop_mode,
  };
}

export async function handleDevicesList(request: Request, env: CloudEnv): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";
  const storeCode = url.searchParams.get("store")?.trim() ?? "";

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status) {
    clauses.push("d.status = ?");
    params.push(status);
  }
  if (storeCode) {
    clauses.push("st.code = ?");
    params.push(storeCode);
  }
  if (q) {
    clauses.push("(LOWER(d.name) LIKE ? OR LOWER(d.code) LIKE ?)");
    const like = `%${q.toLowerCase()}%`;
    params.push(like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const [rows, grouped] = await Promise.all([
    query<DeviceRow>(
      env.DB,
      `SELECT d.id, d.name, d.code, d.status, d.status_label, d.playing, d.progress,
              d.app_version, d.version_warn, d.seen_label, d.seen_alert, d.guide, d.offline,
              d.video_loop_mode, st.id AS store_id, st.name AS store_name, st.code AS store_code,
              sk.id AS skin_id, sk.name AS skin_name, sk.tone AS skin_tone
       FROM devices d
       INNER JOIN stores st ON st.id = d.store_id
       INNER JOIN skins sk ON sk.id = d.skin_id
       ${where}
       ORDER BY d.code ASC`,
      ...params,
    ),
    query<{ status: string; n: number }>(
      env.DB,
      `SELECT d.status, COUNT(*) AS n FROM devices d
       INNER JOIN stores st ON st.id = d.store_id
       ${where}
       GROUP BY d.status`,
      ...params,
    ),
  ]);

  const summary = deviceListSummaryFromGroupBy(
    grouped.map((row) => ({ status: row.status, _count: { _all: Number(row.n) } })),
  );

  return json({
    summary,
    items: rows.map(presentDevice),
  });
}

export async function handleDeviceUpdate(request: Request, env: CloudEnv, id: string): Promise<Response> {
  const device = await first<{ id: string }>(env.DB, `SELECT id FROM devices WHERE id = ?`, id);
  if (!device) return nestError("TV를 찾을 수 없어요", 404);
  let body: { name?: string; videoLoopMode?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  if (body.videoLoopMode && body.videoLoopMode !== "ab" && body.videoLoopMode !== "single") {
    return nestError("영상 반복은 ab 또는 single 이에요", 400);
  }
  const name = body.name?.trim();
  const now = new Date().toISOString();
  await run(
    env.DB,
    `UPDATE devices SET
       name = COALESCE(?, name),
       video_loop_mode = COALESCE(?, video_loop_mode),
       updated_at = ?
     WHERE id = ?`,
    name || null,
    body.videoLoopMode ?? null,
    now,
    id,
  );
  const updated = await first<DeviceRow>(
    env.DB,
    `SELECT d.id, d.name, d.code, d.status, d.status_label, d.playing, d.progress,
            d.app_version, d.version_warn, d.seen_label, d.seen_alert, d.guide, d.offline,
            d.video_loop_mode, st.id AS store_id, st.name AS store_name, st.code AS store_code,
            sk.id AS skin_id, sk.name AS skin_name, sk.tone AS skin_tone
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