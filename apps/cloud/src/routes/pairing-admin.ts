import { assertHq } from "../auth/assert-hq";
import { resolveAuth } from "../auth/session";
import { first, run } from "../db";
import type { CloudEnv } from "../env";
import { json, nestError } from "../http";
import { isUniqueViolation, PAIRING_TTL_MS, randomDeviceCode, randomPairingCode } from "../pairing-code";

export async function handleAdminPairingSession(request: Request, env: CloudEnv): Promise<Response> {
  let body: { storeId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  if (!body.storeId) return nestError("지점이 필요해요", 400);
  const store = await first<{ id: string; name: string; code: string }>(
    env.DB,
    `SELECT id, name, code FROM stores WHERE id = ?`,
    body.storeId,
  );
  if (!store) return nestError("지점을 찾을 수 없어요", 404);
  const now = new Date().toISOString();
  await run(
    env.DB,
    `DELETE FROM pairing_sessions WHERE expires_at < ? AND consumed_at IS NULL`,
    now,
  );
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomPairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
    const id = crypto.randomUUID();
    try {
      await run(
        env.DB,
        `INSERT INTO pairing_sessions (id, store_id, code, expires_at, consumed_at, approved_at, device_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
        id,
        store.id,
        code,
        expiresAt,
        now,
        now,
      );
      return json({
        id,
        code,
        expiresAt,
        store: { id: store.id, name: store.name, code: store.code },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return nestError("연결 코드를 만들지 못했어요. 다시 시도해 주세요", 409);
}

export async function handleApprovePairing(request: Request, env: CloudEnv): Promise<Response> {
  const user = await resolveAuth(request, env.SESSION_SECRET);
  if (!user) return nestError("로그인이 필요해요", 401);
  const forbidden = assertHq(user);
  if (forbidden) return forbidden;
  let body: { code?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const code = body.code?.trim();
  if (!code || !/^\d{6}$/.test(code)) return nestError("6자리 숫자 코드가 필요해요", 400);
  const session = await first<{
    id: string;
    expires_at: string;
    approved_at: string | null;
  }>(env.DB, `SELECT id, expires_at, approved_at FROM pairing_sessions WHERE code = ?`, code);
  if (!session) return nestError("코드를 찾을 수 없어요", 404);
  if (session.expires_at < new Date().toISOString()) return nestError("만료된 코드예요", 400);
  if (session.approved_at) return nestError("이미 승인된 코드예요", 400);

  const defaultSkin = await first<{ id: string }>(
    env.DB,
    `SELECT id FROM skins WHERE is_builtin = 1 ORDER BY created_at ASC LIMIT 1`,
  );
  if (!defaultSkin) return nestError("기본 스킨이 없어요", 400);
  const defaultStore = await first<{ id: string }>(
    env.DB,
    `SELECT id FROM stores WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1`,
  );
  if (!defaultStore) return nestError("활성 지점이 없어요", 400);

  const deviceCode = randomDeviceCode();
  const deviceId = crypto.randomUUID();
  const now = new Date().toISOString();
  const deviceName = `TV ${deviceCode}`;
  await run(
    env.DB,
    `INSERT INTO devices (
      id, store_id, skin_id, name, code, status, status_label, playing, progress,
      app_version, version_warn, seen_label, seen_alert, guide, offline, video_loop_mode, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'ok', '연결 완료', NULL, NULL, '1.0.0', 0, '방금 전', 0, 0, 0, 'ab', ?, ?)`,
    deviceId,
    defaultStore.id,
    defaultSkin.id,
    deviceName,
    deviceCode,
    now,
    now,
  );
  await run(
    env.DB,
    `UPDATE pairing_sessions SET approved_at = ?, device_id = ?, store_id = ?, updated_at = ? WHERE id = ?`,
    now,
    deviceId,
    defaultStore.id,
    now,
    session.id,
  );
  return json({ ok: true, device: { id: deviceId, code: deviceCode, name: deviceName } });
}