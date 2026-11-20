import type { ProgramScreenUsageRow } from "@mvn/shared";
import { parseJsonColumn, query } from "./db";

type SkinTokens = Record<string, unknown>;

type SkinRow = {
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
};

export function presentSkinRow(
  row: SkinRow & { device_count?: number; screen_count?: number },
  extra?: { usedInPrograms?: string[] },
) {
  const base = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    tone: row.tone,
    thumbnailUrl: row.thumbnail_url,
    kind: row.kind,
    tokens: parseJsonColumn<SkinTokens>(row.tokens, {}),
    isActive: !!row.is_active,
    isBuiltin: !!row.is_builtin,
    createdAt: row.created_at,
    storeCount: row.device_count ?? 0,
    screenCount: row.screen_count,
  };
  return extra ? { ...base, ...extra } : base;
}

export async function findSkinByIdOrSlug(db: D1Database, idOrSlug: string): Promise<SkinRow | null> {
  const rows = await query<SkinRow>(db, `SELECT * FROM skins WHERE id = ? OR slug = ? LIMIT 1`, idOrSlug, idOrSlug);
  return rows[0] ?? null;
}

export async function buildProgramUsageMap(db: D1Database): Promise<Map<string, string[]>> {
  const programs = await query<{ id: string; name: string; draft: string; published_version: number | null }>(
    db,
    `SELECT id, name, draft, published_version FROM programs`,
  );
  const withPublished = programs.filter((p) => p.published_version != null);
  const versions =
    withPublished.length === 0
      ? []
      : await query<{ program_id: string; snapshot: string }>(
          db,
          `SELECT program_id, snapshot FROM program_versions WHERE ${withPublished.map(() => "(program_id = ? AND version = ?)").join(" OR ")}`,
          ...withPublished.flatMap((p) => [p.id, p.published_version]),
        );
  const versionByProgram = new Map(versions.map((v) => [v.program_id, v.snapshot]));
  const map = new Map<string, string[]>();
  for (const program of programs) {
    const draft = parseJsonColumn<{ skin?: { id?: string } }>(program.draft, {});
    const published = parseJsonColumn<{ skin?: { id?: string } }>(versionByProgram.get(program.id) ?? null, {});
    const slugs = [draft?.skin?.id, published?.skin?.id].filter(Boolean) as string[];
    for (const slug of slugs) {
      const existing = map.get(slug) ?? [];
      if (!existing.includes(program.name)) {
        existing.push(program.name);
        map.set(slug, existing);
      }
    }
  }
  return map;
}

export async function findSkinUsage(db: D1Database, skinSlug: string): Promise<string[]> {
  const map = await buildProgramUsageMap(db);
  return map.get(skinSlug) ?? [];
}

export async function loadProgramScreenUsageRows(db: D1Database): Promise<ProgramScreenUsageRow[]> {
  const programs = await query<{ id: string; name: string; draft: string; published_version: number | null }>(
    db,
    `SELECT id, name, draft, published_version FROM programs`,
  );
  const withPublished = programs.filter((p) => p.published_version != null);
  const versions =
    withPublished.length === 0
      ? []
      : await query<{ program_id: string; snapshot: string }>(
          db,
          `SELECT program_id, snapshot FROM program_versions WHERE ${withPublished.map(() => "(program_id = ? AND version = ?)").join(" OR ")}`,
          ...withPublished.flatMap((p) => [p.id, p.published_version]),
        );
  const versionByProgram = new Map(versions.map((v) => [v.program_id, parseJsonColumn(v.snapshot, null)]));
  return programs.map((program) => ({
    name: program.name,
    draft: parseJsonColumn(program.draft, {}),
    publishedSnapshot: versionByProgram.get(program.id) ?? null,
  }));
}

export type ScreenRow = {
  id: string;
  skin_id: string;
  title: string;
  html: string;
  css: string;
  has_video_slot: number;
  has_next_video_slot: number;
  title_only: number;
  default_duration_sec: number | null;
  sort_order: number;
  version: number;
  updated_at: string;
};

export function previewFromScreen(row: ScreenRow) {
  return {
    id: row.id,
    title: row.title,
    html: row.html,
    css: row.css,
    hasVideoSlot: !!row.has_video_slot,
    hasNextVideoSlot: !!row.has_next_video_slot,
    titleOnly: !!row.title_only,
    version: row.version,
  };
}