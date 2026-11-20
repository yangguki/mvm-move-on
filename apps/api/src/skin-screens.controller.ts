import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  assertHtmlSkinContentSize,
  HTML_SKIN_CONTENT_MAX_BYTES,
  sanitizeHtmlSkinContent,
} from "@mvn/shared";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";
import {
  compactSortOrderAssignments,
  duplicateScreenTitle,
  neighborSwapIndex,
  parseForceFlag,
  parseMoveDirection,
  SkinScreenOpsError,
} from "./skin-screen-ops";
import {
  parseDefaultDurationSecForCreate,
  parseDefaultDurationSecForUpdate,
  resolveSlotFlagsForCreate,
  resolveSlotFlagsForUpdate,
  SkinScreenInputError,
} from "./skin-screen-input";
import { presentSkinScreen } from "./skin-screen-present";
import {
  programNamesUsingScreen,
  screenDeleteBlockedMessage,
  type ProgramScreenUsageRow,
} from "./skin-screen-usage";

@Controller("admin/v1/skins/:skinId/screens")
@UseGuards(AuthGuard)
export class SkinScreensController {
  constructor(private readonly prisma: PrismaService) {}

  private mapInputError(error: unknown): never {
    if (error instanceof SkinScreenInputError) throw new BadRequestException(error.message);
    throw error;
  }

  private mapOpsError(error: unknown): never {
    if (error instanceof SkinScreenOpsError) throw new BadRequestException(error.message);
    throw error;
  }

  private async loadHtmlSkin(skinId: string) {
    const skin = await this.prisma.skin.findFirst({
      where: { OR: [{ id: skinId }, { slug: skinId }] },
    });
    if (!skin) throw new NotFoundException("스킨을 찾을 수 없어요");
    if (skin.kind !== "html") throw new BadRequestException("HTML 스킨만 화면을 편집할 수 있어요");
    return skin;
  }

  private async loadProgramScreenUsageRows(): Promise<ProgramScreenUsageRow[]> {
    const programs = await this.prisma.program.findMany({
      select: { id: true, name: true, draft: true, publishedVersion: true },
    });
    const withPublished = programs.filter((p) => p.publishedVersion != null);
    const versions = await this.prisma.programVersion.findMany({
      where: {
        programId: { in: withPublished.map((p) => p.id) },
        version: { in: withPublished.map((p) => p.publishedVersion!) },
      },
      select: { programId: true, snapshot: true },
    });
    const versionByProgram = new Map(versions.map((v) => [v.programId, v.snapshot]));
    return programs.map((program) => ({
      name: program.name,
      draft: program.draft,
      publishedSnapshot: versionByProgram.get(program.id) ?? null,
    }));
  }

  private parseContent(raw: { html?: unknown; css?: unknown }) {
    const html = typeof raw.html === "string" ? raw.html : "";
    const css = typeof raw.css === "string" ? raw.css : "";
    const cleaned = sanitizeHtmlSkinContent(html, css);
    assertHtmlSkinContentSize(cleaned.html, cleaned.css, HTML_SKIN_CONTENT_MAX_BYTES);
    return cleaned;
  }

  @Get()
  async list(@Param("skinId") skinId: string) {
    const skin = await this.loadHtmlSkin(skinId);
    const rows = await this.prisma.skinScreen.findMany({
      where: { skinId: skin.id },
      orderBy: { sortOrder: "asc" },
    });
    return { items: rows.map(presentSkinScreen) };
  }

  @Get(":screenId/usage")
  async usage(@Param("skinId") skinId: string, @Param("screenId") screenId: string) {
    const skin = await this.loadHtmlSkin(skinId);
    const row = await this.prisma.skinScreen.findFirst({
      where: { id: screenId, skinId: skin.id },
    });
    if (!row) throw new NotFoundException("화면을 찾을 수 없어요");
    const programs = programNamesUsingScreen(await this.loadProgramScreenUsageRows(), row.id);
    return { programs };
  }

  @Get(":screenId")
  async getOne(@Param("skinId") skinId: string, @Param("screenId") screenId: string) {
    const skin = await this.loadHtmlSkin(skinId);
    const row = await this.prisma.skinScreen.findFirst({
      where: { id: screenId, skinId: skin.id },
    });
    if (!row) throw new NotFoundException("화면을 찾을 수 없어요");
    return presentSkinScreen(row);
  }

  @Post()
  async create(@Param("skinId") skinId: string, @Body() body: unknown) {
    const skin = await this.loadHtmlSkin(skinId);
    if (!body || typeof body !== "object") throw new BadRequestException("본문이 필요해요");
    const raw = body as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) throw new BadRequestException("화면 제목이 필요해요");
    const { html, css } = this.parseContent(raw);
    const slotFlags = (() => {
      try {
        return resolveSlotFlagsForCreate(raw);
      } catch (error) {
        this.mapInputError(error);
      }
    })();
    const defaultDurationSec = (() => {
      try {
        return parseDefaultDurationSecForCreate(raw.defaultDurationSec);
      } catch (error) {
        this.mapInputError(error);
      }
    })();
    const maxOrder = await this.prisma.skinScreen.aggregate({
      where: { skinId: skin.id },
      _max: { sortOrder: true },
    });
    const row = await this.prisma.skinScreen.create({
      data: {
        skinId: skin.id,
        title,
        html,
        css,
        ...slotFlags,
        defaultDurationSec,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
    return presentSkinScreen(row);
  }

  @Post(":screenId/duplicate")
  async duplicate(@Param("skinId") skinId: string, @Param("screenId") screenId: string) {
    const skin = await this.loadHtmlSkin(skinId);
    const source = await this.prisma.skinScreen.findFirst({
      where: { id: screenId, skinId: skin.id },
    });
    if (!source) throw new NotFoundException("화면을 찾을 수 없어요");
    const insertOrder = source.sortOrder + 1;
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.skinScreen.updateMany({
        where: { skinId: skin.id, sortOrder: { gte: insertOrder } },
        data: { sortOrder: { increment: 1 } },
      });
      return tx.skinScreen.create({
        data: {
          skinId: skin.id,
          title: duplicateScreenTitle(source.title),
          html: source.html,
          css: source.css,
          hasVideoSlot: source.hasVideoSlot,
          hasNextVideoSlot: source.hasNextVideoSlot,
          titleOnly: source.titleOnly,
          defaultDurationSec: source.defaultDurationSec,
          sortOrder: insertOrder,
        },
      });
    });
    return presentSkinScreen(row);
  }

  @Post(":screenId/move")
  async move(@Param("skinId") skinId: string, @Param("screenId") screenId: string, @Body() body: unknown) {
    const skin = await this.loadHtmlSkin(skinId);
    const current = await this.prisma.skinScreen.findFirst({
      where: { id: screenId, skinId: skin.id },
    });
    if (!current) throw new NotFoundException("화면을 찾을 수 없어요");
    if (!body || typeof body !== "object") throw new BadRequestException("본문이 필요해요");
    const direction = (() => {
      try {
        return parseMoveDirection((body as { direction?: unknown }).direction);
      } catch (error) {
        this.mapOpsError(error);
      }
    })();
    const rows = await this.prisma.skinScreen.findMany({
      where: { skinId: skin.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, sortOrder: true },
    });
    const sortedIds = rows.map((r) => r.id);
    const swapIdx = neighborSwapIndex(sortedIds, current.id, direction);
    if (swapIdx === null) return presentSkinScreen(current);
    const otherId = sortedIds[swapIdx]!;
    const other = rows.find((r) => r.id === otherId)!;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.skinScreen.update({ where: { id: current.id }, data: { sortOrder: other.sortOrder } });
      await tx.skinScreen.update({ where: { id: other.id }, data: { sortOrder: current.sortOrder } });
      return tx.skinScreen.findUniqueOrThrow({ where: { id: current.id } });
    });
    return presentSkinScreen(updated);
  }

  @Patch(":screenId")
  async update(@Param("skinId") skinId: string, @Param("screenId") screenId: string, @Body() body: unknown) {
    const skin = await this.loadHtmlSkin(skinId);
    const current = await this.prisma.skinScreen.findFirst({
      where: { id: screenId, skinId: skin.id },
    });
    if (!current) throw new NotFoundException("화면을 찾을 수 없어요");
    if (!body || typeof body !== "object") throw new BadRequestException("본문이 필요해요");
    const raw = body as Record<string, unknown>;
    const data: Record<string, unknown> = { version: { increment: 1 } };
    if (typeof raw.title === "string" && raw.title.trim()) data.title = raw.title.trim();
    if (raw.html !== undefined || raw.css !== undefined) {
      const { html, css } = this.parseContent({
        html: raw.html !== undefined ? raw.html : current.html,
        css: raw.css !== undefined ? raw.css : current.css,
      });
      data.html = html;
      data.css = css;
    }
    try {
      const slotUpdate = resolveSlotFlagsForUpdate(raw);
      if (slotUpdate?.mode === "slotType") Object.assign(data, slotUpdate.flags);
      else if (slotUpdate?.mode === "booleans") Object.assign(data, slotUpdate.patch);
      const defaultDurationSec = parseDefaultDurationSecForUpdate(raw.defaultDurationSec);
      if (defaultDurationSec !== undefined) data.defaultDurationSec = defaultDurationSec;
    } catch (error) {
      this.mapInputError(error);
    }
    if (typeof raw.sortOrder === "number" && Number.isInteger(raw.sortOrder)) data.sortOrder = raw.sortOrder;
    const row = await this.prisma.skinScreen.update({ where: { id: current.id }, data });
    return presentSkinScreen(row);
  }

  @Delete(":screenId")
  async remove(
    @Param("skinId") skinId: string,
    @Param("screenId") screenId: string,
    @Query("force") force?: string,
  ) {
    const skin = await this.loadHtmlSkin(skinId);
    const current = await this.prisma.skinScreen.findFirst({
      where: { id: screenId, skinId: skin.id },
    });
    if (!current) throw new NotFoundException("화면을 찾을 수 없어요");
    const programs = programNamesUsingScreen(await this.loadProgramScreenUsageRows(), current.id);
    const blocked = screenDeleteBlockedMessage(programs);
    if (blocked && !parseForceFlag(force)) {
      throw new ConflictException({ message: blocked, programs });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.skinScreen.delete({ where: { id: current.id } });
      const remaining = await tx.skinScreen.findMany({
        where: { skinId: skin.id },
        select: { id: true, sortOrder: true },
      });
      const assignments = compactSortOrderAssignments(remaining);
      for (const { id, sortOrder } of assignments) {
        await tx.skinScreen.update({ where: { id }, data: { sortOrder } });
      }
    });
    return { ok: true };
  }

  @Post("reorder")
  async reorder(@Param("skinId") skinId: string, @Body() body: { order?: string[] }) {
    const skin = await this.loadHtmlSkin(skinId);
    const order = body?.order;
    if (!Array.isArray(order) || !order.length) throw new BadRequestException("order 배열이 필요해요");
    await this.prisma.$transaction(
      order.map((id, sortOrder) =>
        this.prisma.skinScreen.updateMany({
          where: { id, skinId: skin.id },
          data: { sortOrder },
        }),
      ),
    );
    const rows = await this.prisma.skinScreen.findMany({
      where: { skinId: skin.id },
      orderBy: { sortOrder: "asc" },
    });
    return { items: rows.map(presentSkinScreen) };
  }
}