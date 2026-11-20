import type { CloudEnv } from "./env";

export async function query<T extends Record<string, unknown>>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const { results } = await bound.all<T>();
  return results ?? [];
}

export async function first<T extends Record<string, unknown>>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const rows = await query<T>(db, sql, ...params);
  return rows[0] ?? null;
}

export async function run(db: D1Database, sql: string, ...params: unknown[]): Promise<D1Result> {
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  return bound.run();
}

export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJsonColumn(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export type RevUpdateResult =
  | { ok: true; changes: number }
  | { ok: false; reason: "not_found" | "rev_mismatch" };

/** Optimistic lock: UPDATE ... WHERE id = ? AND rev = ? then SET rev = rev + 1 */
export async function bumpSkinRevision(db: D1Database, skinId: string): Promise<void> {
  const now = new Date().toISOString();
  await run(db, `UPDATE skins SET rev = rev + 1, updated_at = ? WHERE id = ?`, now, skinId);
}

export async function updateWithRev(
  env: CloudEnv,
  table: string,
  id: string,
  expectedRev: number,
  setClause: string,
  extraParams: unknown[] = [],
): Promise<RevUpdateResult> {
  const sql = `UPDATE ${table} SET ${setClause}, rev = rev + 1, updated_at = ? WHERE id = ? AND rev = ?`;
  const now = new Date().toISOString();
  const result = await run(env.DB, sql, ...extraParams, now, id, expectedRev);
  const changes = result.meta.changes ?? 0;
  if (changes === 0) {
    const exists = await first(env.DB, `SELECT id, rev FROM ${table} WHERE id = ?`, id);
    if (!exists) return { ok: false, reason: "not_found" };
    return { ok: false, reason: "rev_mismatch" };
  }
  return { ok: true, changes };
}