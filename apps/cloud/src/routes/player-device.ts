import { readDeviceTokenHeader, verifyDeviceToken } from "../auth/device-token";
import { first, run } from "../db";
import type { CloudEnv } from "../env";
import { json, nestError } from "../http";

export type PlayerDeviceAuth = { deviceId: string; storeId: string };

const LAST_SEEN_WRITE_THROTTLE_MS = 30_000;

export async function touchDeviceLastSeenIfStale(
  env: CloudEnv,
  deviceId: string,
  lastSeenAt: string | null,
  now = new Date(),
): Promise<void> {
  if (lastSeenAt) {
    const then = new Date(lastSeenAt).getTime();
    if (!Number.isNaN(then) && now.getTime() - then < LAST_SEEN_WRITE_THROTTLE_MS) return;
  }
  const nowIso = now.toISOString();
  await run(env.DB, `UPDATE devices SET last_seen_at = ?, updated_at = ? WHERE id = ?`, nowIso, nowIso, deviceId);
}

export async function requirePlayerDevice(request: Request, env: CloudEnv): Promise<Response | PlayerDeviceAuth> {
  const token = readDeviceTokenHeader(request);
  const payload = token ? await verifyDeviceToken(env, token) : null;
  if (!payload) return nestError("기기 인증이 필요해요", 401);
  const device = await first<{ store_id: string; last_seen_at: string | null }>(
    env.DB,
    `SELECT store_id, last_seen_at FROM devices WHERE id = ?`,
    payload.deviceId,
  );
  if (!device) return nestError("기기 인증이 필요해요", 401);
  await touchDeviceLastSeenIfStale(env, payload.deviceId, device.last_seen_at);
  return { deviceId: payload.deviceId, storeId: device.store_id };
}

export async function storeAssignedPublishedProgramId(env: CloudEnv, storeId: string): Promise<string | null> {
  const store = await first<{ program_id: string | null }>(env.DB, `SELECT program_id FROM stores WHERE id = ?`, storeId);
  if (!store?.program_id) return null;
  const program = await first<{ published_version: number | null }>(
    env.DB,
    `SELECT published_version FROM programs WHERE id = ?`,
    store.program_id,
  );
  if (!program || program.published_version == null) return null;
  return store.program_id;
}

export async function playerProgramListEntry(
  env: CloudEnv,
  prog: { id: string; name: string; published_version: number; updated_at: string },
) {
  const version = await first<{ published_at: string }>(
    env.DB,
    `SELECT published_at FROM program_versions WHERE program_id = ? AND version = ?`,
    prog.id,
    prog.published_version,
  );
  return {
    id: prog.id,
    name: prog.name,
    publishedVersion: prog.published_version,
    publishedAt: version?.published_at ?? prog.updated_at,
  };
}

export async function handlePlayerProgramsList(request: Request, env: CloudEnv): Promise<Response> {
  const auth = await requirePlayerDevice(request, env);
  if (auth instanceof Response) return auth;
  const assignedId = await storeAssignedPublishedProgramId(env, auth.storeId);
  if (!assignedId) return json({ items: [] });
  const prog = await first<{ id: string; name: string; published_version: number; updated_at: string }>(
    env.DB,
    `SELECT id, name, published_version, updated_at FROM programs WHERE id = ? AND published_version IS NOT NULL`,
    assignedId,
  );
  if (!prog) return json({ items: [] });
  const items = [await playerProgramListEntry(env, prog)];
  return json({ items });
}