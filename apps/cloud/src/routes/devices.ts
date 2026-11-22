import { deviceLastSeenPresent, deviceListSummaryFromGroupBy } from "@mvn/shared";
import { query } from "../db";
import type { CloudEnv } from "../env";
import { json } from "../http";

export { handleDeviceDelete, handleDeviceUpdate } from "./device-mutations";

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
  last_seen_at: string | null;
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

function presentDevice(row: DeviceRow, now = new Date()) {
  const seen = deviceLastSeenPresent(row.last_seen_at, now);
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
    lastSeenAt: seen.lastSeenAt,
    seenLabel: seen.seenLabel,
    seenAlert: seen.seenAlert,
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
              d.app_version, d.version_warn, d.last_seen_at, d.guide, d.offline,
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

  const now = new Date();
  return json({
    summary,
    items: rows.map((row) => presentDevice(row, now)),
  });
}
