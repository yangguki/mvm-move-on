import { buildAdminDashboardResponse } from "@mvn/shared";
import { query } from "../db";
import type { CloudEnv } from "../env";
import { json } from "../http";

type DeviceRow = {
  code: string;
  name: string;
  status: string;
  playing: string | null;
  offline: number;
  seen_label: string;
  store_name: string;
};

export async function handleDashboard(_request: Request, env: CloudEnv): Promise<Response> {
  const deviceRows = await query<DeviceRow>(
    env.DB,
    `SELECT d.code, d.name, d.status, d.playing, d.offline, d.seen_label, st.name AS store_name
     FROM devices d
     INNER JOIN stores st ON st.id = d.store_id
     ORDER BY d.code ASC`,
  );
  const devices = deviceRows.map((row) => ({
    code: row.code,
    name: row.name,
    status: row.status,
    playing: row.playing,
    offline: !!row.offline,
    seenLabel: row.seen_label,
    store: { name: row.store_name },
  }));

  const storeRows = await query<{ id: string }>(env.DB, `SELECT id FROM stores`);
  const allDevices = await query<{ store_id: string; offline: number }>(
    env.DB,
    `SELECT store_id, offline FROM devices`,
  );
  const byStore = new Map<string, { offline: boolean }[]>();
  for (const store of storeRows) byStore.set(store.id, []);
  for (const row of allDevices) {
    const list = byStore.get(row.store_id) ?? [];
    list.push({ offline: !!row.offline });
    byStore.set(row.store_id, list);
  }
  const stores = storeRows.map((store) => ({
    devices: byStore.get(store.id) ?? [],
  }));

  return json(buildAdminDashboardResponse(devices, stores));
}