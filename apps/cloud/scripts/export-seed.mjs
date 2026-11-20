import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const seedDir = path.join(root, "seed");

const TABLE_QUERIES = {
  programs: `
    SELECT id, name, status, draft::text AS draft, draft_updated_at, published_version,
           created_at, updated_at, 0 AS rev
    FROM programs
    ORDER BY created_at`,
  program_versions: `
    SELECT id, program_id, version, published_at, snapshot::text AS snapshot
    FROM program_versions
    ORDER BY program_id, version`,
  skins: `
    SELECT id, slug, name, description, tone, thumbnail_url, kind, tokens::text AS tokens,
           is_active, is_builtin, created_at, updated_at, 0 AS rev
    FROM skins
    ORDER BY slug`,
  skin_screens: `
    SELECT id, skin_id, title, html, css, has_video_slot, has_next_video_slot, title_only,
           default_duration_sec, sort_order, version, created_at, updated_at
    FROM skin_screens
    ORDER BY skin_id, sort_order`,
  videos: `
    SELECT id, name, url, duration_sec, thumbnail_url, width, height, status, source_type,
           error, size_bytes, created_at, created_at AS updated_at
    FROM videos
    ORDER BY created_at`,
  stores: `
    SELECT id, name, code, is_active, program_id, created_at, updated_at
    FROM stores
    ORDER BY code`,
  devices: `
    SELECT id, store_id, skin_id, name, code, status, status_label, playing, progress,
           app_version, version_warn, seen_label, seen_alert, guide, offline, video_loop_mode,
           created_at, updated_at
    FROM devices
    ORDER BY code`,
};

const INSERT_ORDER = [
  "programs",
  "program_versions",
  "skins",
  "skin_screens",
  "videos",
  "stores",
  "devices",
];

function psqlJson(sql) {
  const query = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (${sql}) t`;
  const out = execFileSync(
    "docker",
    ["exec", "mvn-postgres-1", "psql", "-U", "mvn", "-d", "mvn", "-t", "-A", "-c", query],
    { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
  ).trim();
  return JSON.parse(out || "[]");
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return sqlValue(JSON.stringify(value));
  return `'${String(value).replace(/'/g, "''")}'`;
}

function rowsToInsert(table, rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const lines = rows.map((row) => {
    const vals = cols.map((c) => sqlValue(row[c]));
    return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${vals.join(", ")});`;
  });
  return lines.join("\n");
}

const seed = {};
for (const [table, innerSql] of Object.entries(TABLE_QUERIES)) {
  seed[table] = psqlJson(innerSql);
}

fs.mkdirSync(seedDir, { recursive: true });
fs.writeFileSync(path.join(seedDir, "seed.json"), `${JSON.stringify(seed, null, 2)}\n`);

const sqlParts = [
  "PRAGMA foreign_keys = ON;",
  ...INSERT_ORDER.map((t) => rowsToInsert(t, seed[t])),
].filter(Boolean);
fs.writeFileSync(path.join(seedDir, "seed.sql"), `${sqlParts.join("\n")}\n`);

console.log("Exported seed:");
for (const t of INSERT_ORDER) {
  console.log(`  ${t}: ${seed[t].length}`);
}