import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "wrangler.toml");
const seedPath = path.join(root, "seed", "seed.json");

const DELETE_ORDER = [
  "devices",
  "stores",
  "skin_screens",
  "videos",
  "program_versions",
  "programs",
  "skins",
];

const INSERT_ORDER = [
  "programs",
  "program_versions",
  "skins",
  "skin_screens",
  "videos",
  "stores",
  "devices",
];

const TABLE_COLUMNS = {
  programs: [
    "id",
    "name",
    "status",
    "draft",
    "draft_updated_at",
    "published_version",
    "created_at",
    "updated_at",
    "rev",
  ],
  program_versions: ["id", "program_id", "version", "published_at", "snapshot"],
  skins: [
    "id",
    "slug",
    "name",
    "description",
    "tone",
    "thumbnail_url",
    "kind",
    "tokens",
    "is_active",
    "is_builtin",
    "created_at",
    "updated_at",
    "rev",
  ],
  skin_screens: [
    "id",
    "skin_id",
    "title",
    "html",
    "css",
    "has_video_slot",
    "has_next_video_slot",
    "title_only",
    "default_duration_sec",
    "sort_order",
    "version",
    "created_at",
    "updated_at",
  ],
  videos: [
    "id",
    "name",
    "url",
    "duration_sec",
    "thumbnail_url",
    "width",
    "height",
    "status",
    "source_type",
    "error",
    "size_bytes",
    "created_at",
    "updated_at",
  ],
  stores: ["id", "name", "code", "is_active", "program_id", "created_at", "updated_at"],
  devices: [
    "id",
    "store_id",
    "skin_id",
    "name",
    "code",
    "status",
    "status_label",
    "playing",
    "progress",
    "app_version",
    "version_warn",
    "seen_label",
    "seen_alert",
    "guide",
    "offline",
    "video_loop_mode",
    "created_at",
    "updated_at",
  ],
};

function bindValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  return String(value);
}

function rowValues(table, row) {
  return TABLE_COLUMNS[table].map((col) => bindValue(row[col]));
}

function insertSql(table) {
  const cols = TABLE_COLUMNS[table];
  const placeholders = cols.map(() => "?").join(", ");
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
}

const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const { env, dispose } = await getPlatformProxy({ configPath, persist: true });

try {
  const db = env.DB;
  if (!db) {
    console.error("DB binding not found");
    process.exit(1);
  }

  for (const table of DELETE_ORDER) {
    await db.prepare(`DELETE FROM ${table}`).run();
  }

  for (const table of INSERT_ORDER) {
    const rows = seed[table] ?? [];
    const sql = insertSql(table);
    for (const row of rows) {
      const values = rowValues(table, row);
      await db.prepare(sql).bind(...values).run();
    }
  }

  console.log("Local D1 seed OK. Row counts:");
  for (const table of INSERT_ORDER) {
    const expected = seed[table]?.length ?? 0;
    const result = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first();
    const actual = Number(result?.n ?? 0);
    const mark = actual === expected ? "OK" : "MISMATCH";
    console.log(`  ${table}: ${actual} (expected ${expected}) ${mark}`);
    if (actual !== expected) process.exitCode = 1;
  }
} finally {
  await dispose();
}