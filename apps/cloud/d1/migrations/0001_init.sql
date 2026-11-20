-- D1 (SQLite) schema for MVN cloud — derived from packages/db/prisma/schema.prisma (subset)

PRAGMA foreign_keys = ON;

CREATE TABLE programs (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  draft TEXT NOT NULL,
  draft_updated_at TEXT NOT NULL,
  published_version INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE program_versions (
  id TEXT PRIMARY KEY NOT NULL,
  program_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  published_at TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  FOREIGN KEY (program_id) REFERENCES programs (id) ON DELETE CASCADE,
  UNIQUE (program_id, version)
);

CREATE INDEX program_versions_program_id_idx ON program_versions (program_id);

CREATE TABLE skins (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  tone TEXT NOT NULL,
  thumbnail_url TEXT,
  kind TEXT NOT NULL DEFAULT 'tokens',
  tokens TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE skin_screens (
  id TEXT PRIMARY KEY NOT NULL,
  skin_id TEXT NOT NULL,
  title TEXT NOT NULL,
  html TEXT NOT NULL DEFAULT '',
  css TEXT NOT NULL DEFAULT '',
  has_video_slot INTEGER NOT NULL DEFAULT 0,
  has_next_video_slot INTEGER NOT NULL DEFAULT 0,
  title_only INTEGER NOT NULL DEFAULT 0,
  default_duration_sec INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (skin_id) REFERENCES skins (id) ON DELETE CASCADE
);

CREATE INDEX skin_screens_skin_id_sort_order_idx ON skin_screens (skin_id, sort_order);

CREATE TABLE videos (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  thumbnail_url TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  source_type TEXT NOT NULL DEFAULT 'url',
  error TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE stores (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  program_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (program_id) REFERENCES programs (id) ON DELETE SET NULL
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY NOT NULL,
  store_id TEXT NOT NULL,
  skin_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  status_label TEXT NOT NULL,
  playing TEXT,
  progress INTEGER,
  app_version TEXT NOT NULL,
  version_warn INTEGER NOT NULL DEFAULT 0,
  seen_label TEXT NOT NULL,
  seen_alert INTEGER NOT NULL DEFAULT 0,
  guide INTEGER NOT NULL DEFAULT 0,
  offline INTEGER NOT NULL DEFAULT 0,
  video_loop_mode TEXT NOT NULL DEFAULT 'ab',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE RESTRICT,
  FOREIGN KEY (skin_id) REFERENCES skins (id) ON DELETE RESTRICT
);

CREATE TABLE pairing_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  store_id TEXT,
  code TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  approved_at TEXT,
  device_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE SET NULL
);