import {
  assertHtmlSkinContentSize,
  collectScreenIds,
  HTML_SKIN_CONTENT_MAX_BYTES,
  sanitizeHtmlSkinContent,
  type HtmlSkinScreensMap,
  type ProgramItem,
  type SkinScreenSnapshot,
} from "@mvn/shared";
import type { PrismaService } from "./prisma.service";

function presentScreen(row: {
  id: string;
  title: string;
  html: string;
  css: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
  version: number;
}): SkinScreenSnapshot {
  const { html, css } = sanitizeHtmlSkinContent(row.html, row.css);
  return {
    id: row.id,
    title: row.title,
    html,
    css,
    hasVideoSlot: row.hasVideoSlot,
    hasNextVideoSlot: row.hasNextVideoSlot,
    titleOnly: row.titleOnly,
    version: row.version,
  };
}

export async function freezeHtmlSkinScreens(
  prisma: PrismaService,
  skinId: string,
  items: ProgramItem[],
): Promise<HtmlSkinScreensMap> {
  const screenIds = collectScreenIds(items);
  const allScreens = await prisma.skinScreen.findMany({
    where: { skinId },
    orderBy: { sortOrder: "asc" },
  });
  const usedIds = new Set(screenIds);
  if (usedIds.size === 0 && allScreens.length > 0) {
    const fallback = allScreens.find((s) => s.hasVideoSlot) ?? allScreens[0];
    if (fallback) usedIds.add(fallback.id);
  }
  const rows = allScreens.filter((s) => usedIds.has(s.id));
  const map: HtmlSkinScreensMap = {};
  for (const row of rows) {
    assertHtmlSkinContentSize(row.html, row.css, HTML_SKIN_CONTENT_MAX_BYTES);
    map[row.id] = presentScreen(row);
  }
  return map;
}

export function snapshotScreenVersions(map: HtmlSkinScreensMap | undefined): Record<string, number> {
  if (!map) return {};
  const out: Record<string, number> = {};
  for (const [id, screen] of Object.entries(map)) out[id] = screen.version;
  return out;
}

export async function currentHtmlScreenVersions(prisma: PrismaService, skinUuid: string): Promise<Record<string, number>> {
  const rows = await prisma.skinScreen.findMany({
    where: { skinId: skinUuid },
    select: { id: true, version: true },
  });
  const out: Record<string, number> = {};
  for (const row of rows) out[row.id] = row.version;
  return out;
}