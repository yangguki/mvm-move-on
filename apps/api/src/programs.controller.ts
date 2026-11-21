import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  collectMissingPublishVideos,
  collectMissingHtmlProgramScreens,
  collectVideoRefs,
  expand,
  missingPublishScreensMessage,
  missingPublishVideosMessage,
  presentProgram,
  presentVideoRow,
  programDeleteBlockedMessage,
  type Program as SharedProgram,
  type PublishedSnapshot,
  type SkinPublishMeta,
  type VideoMap,
  stripStaleHtmlProgramVideoIds,
  validateHtmlProgramSteps,
  validateProgram,
} from "@mvn/shared";
import { resolveProgramSkin } from "./audio-resolve";
import { currentHtmlScreenVersions, freezeHtmlSkinScreens } from "./html-skin-publish";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";

async function freezeVideos(prisma: PrismaService, items: SharedProgram["items"]): Promise<VideoMap> {
  const refs = collectVideoRefs(items);
  if (!refs.length) return {};
  const ids = [...new Set(refs.map((ref) => ref.videoId))];
  const rows = await prisma.video.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((row) => [row.id, presentVideoRow(row)]));
  const missing = refs.filter((ref) => !byId.has(ref.videoId));
  if (missing.length) {
    const detail = missing.map((ref) => `${ref.path}(videoId=${ref.videoId})`).join(", ");
    throw new BadRequestException(`존재하지 않는 영상이 있어요: ${detail}`);
  }
  const videos: VideoMap = {};
  for (const id of ids) videos[id] = byId.get(id)!;
  return videos;
}

type DraftBody = {
  items?: unknown;
  skin?: unknown;
};

async function asDraft(
  prisma: PrismaService,
  raw: unknown,
): Promise<{ items: SharedProgram["items"]; skin: SharedProgram["skin"] }> {
  try {
    const checked = validateProgram({
      id: "draft",
      name: "tmp",
      status: "draft",
      draftUpdatedAt: new Date().toISOString(),
      publishedVersion: null,
      ...(typeof raw === "object" && raw ? raw : {}),
    });
    const skinRow = await prisma.skin.findFirst({ where: { slug: checked.skin.id } });
    if (skinRow?.kind === "html") {
      const screenRows = await prisma.skinScreen.findMany({
        where: { skinId: skinRow.id },
        select: { id: true, hasVideoSlot: true, hasNextVideoSlot: true, titleOnly: true },
      });
      const screenRefs = screenRows.map((row) => ({
        id: row.id,
        hasVideoSlot: row.hasVideoSlot,
        hasNextVideoSlot: row.hasNextVideoSlot,
        titleOnly: row.titleOnly,
      }));
      checked.items = stripStaleHtmlProgramVideoIds(checked.items, screenRefs);
      validateHtmlProgramSteps(checked.items, screenRefs, "draft");
      checked.skin.kind = "html";
    } else if (skinRow?.kind === "tokens") {
      checked.skin.kind = "tokens";
    }
    return { items: checked.items, skin: checked.skin };
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : "프로그램 draft가 올바르지 않아요");
  }
}

@Controller("admin/v1/programs")
@UseGuards(AuthGuard)
export class ProgramsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.program.findMany({ orderBy: { updatedAt: "desc" } });
    const publishedIds = rows.filter((r) => r.publishedVersion != null).map((r) => r.id);
    const versions = await this.prisma.programVersion.findMany({
      where: {
        programId: { in: publishedIds },
        version: { in: rows.filter((r) => r.publishedVersion).map((r) => r.publishedVersion!) },
      },
      select: { programId: true, version: true, snapshot: true },
    });
    const snapshotMap = new Map(
      versions.map((v) => {
        const snap = v.snapshot as { items: unknown; skin: { options: unknown } };
        return [v.programId, { items: snap.items, skin: snap.skin }];
      }),
    );
    const skinSlugs = [...new Set(rows.map((r) => (r.draft as { skin?: { id?: string } })?.skin?.id).filter(Boolean))] as string[];
    const skinRows = await this.prisma.skin.findMany({ where: { slug: { in: skinSlugs } } });
    const skinMetaMap = new Map(
      await Promise.all(
        skinRows.map(async (s) => {
          const screenVersions = s.kind === "html" ? await currentHtmlScreenVersions(this.prisma, s.id) : null;
          return [
            s.slug,
            { tokens: s.tokens as Record<string, unknown>, kind: s.kind, screenVersions } satisfies SkinPublishMeta,
          ] as const;
        }),
      ),
    );
    return {
      items: rows.map((r) => {
        const skinSlug = (r.draft as { skin?: { id?: string } })?.skin?.id;
        const skinMeta = skinSlug ? skinMetaMap.get(skinSlug) ?? null : null;
        return presentProgram(r, snapshotMap.get(r.id), skinMeta);
      }),
    };
  }

  @Post()
  async create(@Body() body: { name?: string; draft?: DraftBody }) {
    const name = body.name?.trim() ?? "";
    if (!name) throw new BadRequestException("프로그램 이름이 필요해요");
    const draft = await asDraft(this.prisma, {
      name,
      status: "draft",
      items: body.draft?.items ?? [{ id: "guide-1", type: "guide", durationSec: 10, label: "시작 카운트다운" }],
      skin: body.draft?.skin ?? {
        id: "neon-arcade",
        options: { pointColor: "#C8F31D", nextLeadSec: 10 },
      },
    });
    const row = await this.prisma.program.create({
      data: { name, status: "draft", draft: JSON.parse(JSON.stringify(draft)), draftUpdatedAt: new Date() },
    });
    return presentProgram(row, null);
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    const row = await this.load(id);
    const published = await this.getPublishedSnapshot(row.id, row.publishedVersion);
    return presentProgram(row, published, await this.skinMetaForDraft(row.draft));
  }

  @Put(":id")
  async save(@Param("id") id: string, @Body() body: { name?: string; draft?: DraftBody; items?: unknown; skin?: unknown }) {
    const current = await this.load(id);
    const name = body.name?.trim() || current.name;
    const incoming = body.draft ?? { items: body.items, skin: body.skin };
    const draft = await asDraft(this.prisma, {
      name,
      status: "draft",
      items: incoming.items ?? (current.draft as DraftBody).items,
      skin: incoming.skin ?? (current.draft as DraftBody).skin,
    });
    const row = await this.prisma.program.update({
      where: { id },
      data: {
        name,
        status: "draft",
        draft: JSON.parse(JSON.stringify(draft)),
        draftUpdatedAt: new Date(),
      },
    });
    const published = await this.getPublishedSnapshot(row.id, row.publishedVersion);
    return presentProgram(row, published, await this.skinMetaForDraft(row.draft));
  }

  @Post(":id/publish")
  async publish(@Param("id") id: string) {
    const current = await this.load(id);
    const draft = current.draft as { items: SharedProgram["items"]; skin: SharedProgram["skin"] };
    const nextVersion = (current.publishedVersion ?? 0) + 1;
    const skin = await resolveProgramSkin(this.prisma, draft.skin);
    const skinRow = await this.prisma.skin.findFirst({ where: { slug: draft.skin.id } });
    const skinKind = skinRow?.kind ?? "tokens";
    const skinTokens = skinRow && skinKind === "tokens" ? (skinRow.tokens as Record<string, unknown>) : {};
    const screenRows =
      skinRow && skinKind === "html"
        ? await this.prisma.skinScreen.findMany({
            where: { skinId: skinRow.id },
            select: { id: true, hasVideoSlot: true, hasNextVideoSlot: true, titleOnly: true },
          })
        : [];
    const missingVideos = collectMissingPublishVideos(draft.items, {
      skinKind,
      screens: screenRows,
    });
    const missingMessage = missingPublishVideosMessage(missingVideos);
    if (missingMessage) throw new BadRequestException(missingMessage);
    if (skinKind === "html") {
      const missingScreens = collectMissingHtmlProgramScreens(draft.items, screenRows);
      const missingScreensMessage = missingPublishScreensMessage(missingScreens);
      if (missingScreensMessage) throw new BadRequestException(missingScreensMessage);
      try {
        validateHtmlProgramSteps(draft.items, screenRows, "publish");
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : "프로그램 draft가 올바르지 않아요");
      }
    }
    const screens = skinRow && skinKind === "html" ? await freezeHtmlSkinScreens(this.prisma, skinRow.id, draft.items) : undefined;
    const videos = await freezeVideos(this.prisma, draft.items);
    const base = validateProgram({
      id: current.id,
      name: current.name,
      status: "published",
      draftUpdatedAt: current.draftUpdatedAt.toISOString(),
      publishedVersion: nextVersion,
      skin: { ...skin, kind: skinKind, tokens: skinKind === "tokens" ? skinTokens : undefined, screens },
      items: draft.items,
    });
    const snapshot: PublishedSnapshot = { ...base, videos };
    await this.prisma.$transaction(async (tx) => {
      await tx.programVersion.create({
        data: {
          programId: id,
          version: nextVersion,
          snapshot: JSON.parse(JSON.stringify(snapshot)),
        },
      });
      await tx.program.update({
        where: { id },
        data: {
          status: "published",
          publishedVersion: nextVersion,
        },
      });
    });
    const row = await this.load(id);
    const published = await this.getPublishedSnapshot(row.id, row.publishedVersion);
    return presentProgram(row, published);
  }

  @Get(":id/versions")
  async versions(@Param("id") id: string) {
    await this.load(id);
    const rows = await this.prisma.programVersion.findMany({
      where: { programId: id },
      orderBy: { version: "desc" },
    });
    return {
      items: rows.map((version) => {
        const snap = version.snapshot as PublishedSnapshot;
        return {
          id: version.id,
          version: version.version,
          name: snap.name,
          publishedAt: version.publishedAt,
          stepCount: expand(snap, snap.videos ?? {}).length,
          skin: snap.skin,
        };
      }),
    };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const current = await this.prisma.program.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("프로그램을 찾을 수 없어요");

    const assignedStoreCount = await this.prisma.store.count({ where: { programId: id } });
    const blocked = programDeleteBlockedMessage(assignedStoreCount);
    if (blocked) throw new ConflictException(blocked);

    await this.prisma.$transaction(async (tx) => {
      await tx.programVersion.deleteMany({ where: { programId: id } });
      await tx.program.delete({ where: { id } });
    });
    return { ok: true };
  }

  private async skinMetaForDraft(draft: unknown): Promise<SkinPublishMeta | null> {
    const skinSlug = (draft as { skin?: { id?: string } })?.skin?.id;
    if (!skinSlug) return null;
    const skinRow = await this.prisma.skin.findFirst({ where: { slug: skinSlug } });
    if (!skinRow) return null;
    const screenVersions = skinRow.kind === "html" ? await currentHtmlScreenVersions(this.prisma, skinRow.id) : null;
    return {
      tokens: skinRow.tokens as Record<string, unknown>,
      kind: skinRow.kind,
      screenVersions,
    };
  }

  private async load(id: string) {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program) throw new NotFoundException("프로그램을 찾을 수 없어요");
    return program;
  }

  private async getPublishedSnapshot(programId: string, publishedVersion: number | null) {
    if (publishedVersion == null) return null;
    const version = await this.prisma.programVersion.findFirst({
      where: { programId, version: publishedVersion },
      select: { snapshot: true },
    });
    if (!version) return null;
    const snap = version.snapshot as { items: unknown; skin: unknown };
    return { items: snap.items, skin: snap.skin };
  }
}
