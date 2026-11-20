import {
  buildHtmlSkinScreensMap,
  collectScreenIds,
  resolveHtmlPublishScreenIds,
  type HtmlSkinScreensMap,
  type ProgramItem,
} from "@mvn/shared";
import type { PrismaService } from "./prisma.service";

export { snapshotScreenVersions } from "@mvn/shared";

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
  const usedIds = resolveHtmlPublishScreenIds(screenIds, allScreens);
  const rows = allScreens.filter((s) => usedIds.has(s.id));
  return buildHtmlSkinScreensMap(rows);
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