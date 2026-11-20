import { validateVideoInput } from "@mvn/shared";
import { first, parseJsonColumn, query, run } from "../db";
import type { CloudEnv } from "../env";
import { json, nestConflict, nestError } from "../http";

type VideoDbRow = {
  id: string;
  name: string;
  url: string;
  duration_sec: number;
  thumbnail_url: string;
  width: number;
  height: number;
  status: string;
  source_type: string;
  error: string | null;
  size_bytes: number | null;
  created_at: string;
};

function presentVideo(row: VideoDbRow) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    durationSec: row.duration_sec,
    thumbnailUrl: row.thumbnail_url,
    width: row.width,
    height: row.height,
    status: row.status,
    sourceType: row.source_type,
    error: row.error,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

export async function handleVideosList(_request: Request, env: CloudEnv): Promise<Response> {
  const rows = await query<VideoDbRow>(env.DB, `SELECT * FROM videos ORDER BY created_at DESC`);
  return json({ items: rows.map(presentVideo) });
}

export async function handleVideoGet(_request: Request, env: CloudEnv, id: string): Promise<Response> {
  const row = await first<VideoDbRow>(env.DB, `SELECT * FROM videos WHERE id = ? LIMIT 1`, id);
  if (!row) return nestError("영상을 찾을 수 없어요", 404);
  return json(presentVideo(row));
}

export async function handleVideoCreate(request: Request, env: CloudEnv): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  let input;
  try {
    input = validateVideoInput(body);
  } catch (error) {
    return nestError(error instanceof Error ? error.message : "영상 정보가 올바르지 않아요", 400);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(
    env.DB,
    `INSERT INTO videos (id, name, url, duration_sec, thumbnail_url, width, height, status, source_type, error, size_bytes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', 'url', NULL, NULL, ?, ?)`,
    id,
    input.name,
    input.url,
    input.durationSec,
    input.thumbnailUrl,
    input.width,
    input.height,
    now,
    now,
  );
  const row = await first<VideoDbRow>(env.DB, `SELECT * FROM videos WHERE id = ?`, id);
  return json(presentVideo(row!), 201);
}

export async function handleVideoUpload(): Promise<Response> {
  return nestError("클라우드 모드에서는 영상 업로드를 지원하지 않아요", 501);
}

export async function handleVideoUpdate(request: Request, env: CloudEnv, id: string): Promise<Response> {
  const current = await first<VideoDbRow>(env.DB, `SELECT * FROM videos WHERE id = ? LIMIT 1`, id);
  if (!current) return nestError("영상을 찾을 수 없어요", 404);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  let input;
  try {
    input = validateVideoInput({ ...presentVideo(current), ...(typeof body === "object" && body ? body : {}) });
  } catch (error) {
    return nestError(error instanceof Error ? error.message : "영상 정보가 올바르지 않아요", 400);
  }
  const now = new Date().toISOString();
  await run(
    env.DB,
    `UPDATE videos SET name = ?, url = ?, duration_sec = ?, thumbnail_url = ?, width = ?, height = ?, updated_at = ? WHERE id = ?`,
    input.name,
    input.url,
    input.durationSec,
    input.thumbnailUrl,
    input.width,
    input.height,
    now,
    id,
  );
  const row = await first<VideoDbRow>(env.DB, `SELECT * FROM videos WHERE id = ?`, id);
  return json(presentVideo(row!));
}

export async function handleVideoDelete(_request: Request, env: CloudEnv, id: string): Promise<Response> {
  const current = await first<VideoDbRow>(env.DB, `SELECT * FROM videos WHERE id = ? LIMIT 1`, id);
  if (!current) return nestError("영상을 찾을 수 없어요", 404);

  const programs = await query<{ draft: string }>(
    env.DB,
    `SELECT draft FROM programs WHERE published_version IS NULL`,
  );
  for (const prog of programs) {
    const draft = parseJsonColumn<{ items?: Array<{ videoId?: string; steps?: Array<{ videoId?: string }> }> }>(
      prog.draft,
      {},
    );
    if (!draft?.items) continue;
    for (const item of draft.items) {
      if (item.videoId === id) {
        return nestConflict({ message: "작업 중인 프로그램에서 사용 중인 영상은 삭제할 수 없어요" });
      }
      if (item.steps) {
        for (const step of item.steps) {
          if (step.videoId === id) {
            return nestConflict({ message: "작업 중인 프로그램에서 사용 중인 영상은 삭제할 수 없어요" });
          }
        }
      }
    }
  }

  await run(env.DB, `DELETE FROM videos WHERE id = ?`, id);
  return json({ ok: true });
}