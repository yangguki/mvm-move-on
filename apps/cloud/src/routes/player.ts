import { presentPlayerProgramSnapshot, type PublishedSnapshot } from "@mvn/shared";
import { readDeviceTokenHeader, signDeviceToken, verifyDeviceToken } from "../auth/device-token";
import { first, parseJsonColumn, query, run } from "../db";
import type { CloudEnv } from "../env";
import { json, nestError } from "../http";
import { isUniqueViolation, PAIRING_TTL_MS, randomPairingCode } from "../pairing-code";

async function requireDevice(request: Request, env: CloudEnv): Promise<Response | { payload: { storeId: string; deviceId: string } }> {
  const token = readDeviceTokenHeader(request);
  const payload = token ? await verifyDeviceToken(env, token) : null;
  if (!payload) return nestError("기기 인증이 필요해요", 401);
  return { payload };
}

export async function handlePlayerRequestCode(_request: Request, env: CloudEnv): Promise<Response> {
  const now = new Date().toISOString();
  await run(env.DB, `DELETE FROM pairing_sessions WHERE expires_at < ?`, now);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomPairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
    const id = crypto.randomUUID();
    try {
      await run(
        env.DB,
        `INSERT INTO pairing_sessions (id, store_id, code, expires_at, consumed_at, approved_at, device_id, created_at, updated_at)
         VALUES (?, NULL, ?, ?, NULL, NULL, NULL, ?, ?)`,
        id,
        code,
        expiresAt,
        now,
        now,
      );
      return json({ code, expiresAt });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return nestError("코드를 생성하지 못했어요. 다시 시도해 주세요", 400);
}

export async function handlePlayerCodeStatus(_request: Request, env: CloudEnv, code: string): Promise<Response> {
  const session = await first<{
    id: string;
    expires_at: string;
    approved_at: string | null;
    device_id: string | null;
    store_id: string | null;
  }>(env.DB, `SELECT id, expires_at, approved_at, device_id, store_id FROM pairing_sessions WHERE code = ?`, code);
  if (!session) return nestError("코드를 찾을 수 없어요", 404);
  if (session.expires_at < new Date().toISOString()) {
    return json({ status: "expired" });
  }
  if (session.approved_at && session.device_id) {
    const token = await signDeviceToken(env, session.store_id ?? "", session.device_id);
    const now = new Date().toISOString();
    await run(env.DB, `UPDATE pairing_sessions SET consumed_at = ?, updated_at = ? WHERE id = ?`, now, now, session.id);
    return json({ status: "approved", token });
  }
  return json({ status: "pending", expiresAt: session.expires_at });
}

export async function handlePlayerProgramsList(request: Request, env: CloudEnv): Promise<Response> {
  const auth = await requireDevice(request, env);
  if (auth instanceof Response) return auth;
  const rows = await query<{ id: string; name: string; published_version: number; updated_at: string }>(
    env.DB,
    `SELECT id, name, published_version, updated_at FROM programs WHERE published_version IS NOT NULL ORDER BY updated_at DESC`,
  );
  const items = await Promise.all(
    rows.map(async (prog) => {
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
    }),
  );
  return json({ items });
}

export async function handlePlayerProgramDetail(request: Request, env: CloudEnv, id: string): Promise<Response> {
  const auth = await requireDevice(request, env);
  if (auth instanceof Response) return auth;
  const program = await first<{ id: string; name: string; published_version: number | null; updated_at: string }>(
    env.DB,
    `SELECT id, name, published_version, updated_at FROM programs WHERE id = ?`,
    id,
  );
  if (!program || program.published_version == null) {
    return nestError("발행된 프로그램을 찾을 수 없어요", 404);
  }
  const version = await first<{ version: number; published_at: string; snapshot: string }>(
    env.DB,
    `SELECT version, published_at, snapshot FROM program_versions WHERE program_id = ? AND version = ?`,
    id,
    program.published_version,
  );
  if (!version) return nestError("발행 스냅샷을 찾을 수 없어요", 404);
  const snapshot = parseJsonColumn<PublishedSnapshot>(version.snapshot, {} as PublishedSnapshot);
  return json(
    presentPlayerProgramSnapshot(snapshot, {
      publishedVersion: version.version,
      publishedAt: version.published_at,
    }),
  );
}