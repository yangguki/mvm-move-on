import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  assertHtmlSkinContentSize,
  HTML_SKIN_CONTENT_MAX_BYTES,
  sanitizeHtmlSkinContent,
} from "@mvn/shared";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";

function presentScreen(row: {
  id: string;
  skinId: string;
  title: string;
  html: string;
  css: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
  sortOrder: number;
  version: number;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    skinId: row.skinId,
    title: row.title,
    html: row.html,
    css: row.css,
    hasVideoSlot: row.hasVideoSlot,
    hasNextVideoSlot: row.hasNextVideoSlot,
    titleOnly: row.titleOnly,
    sortOrder: row.sortOrder,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Controller("admin/v1/skins/:skinId/screens")
@UseGuards(AuthGuard)
export class SkinScreensController {
  constructor(private readonly prisma: PrismaService) {}

  private async loadHtmlSkin(skinId: string) {
    const skin = await this.prisma.skin.findFirst({
      where: { OR: [{ id: skinId }, { slug: skinId }] },
    });
    if (!skin) throw new NotFoundException("스킨을 찾을 수 없어요");
    if (skin.kind !== "html") throw new BadRequestException("HTML 스킨만 화면을 편집할 수 있어요");
    return skin;
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
    return { items: rows.map(presentScreen) };
  }

  @Post()
  async create(@Param("skinId") skinId: string, @Body() body: unknown) {
    const skin = await this.loadHtmlSkin(skinId);
    if (!body || typeof body !== "object") throw new BadRequestException("본문이 필요해요");
    const raw = body as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) throw new BadRequestException("화면 제목이 필요해요");
    const { html, css } = this.parseContent(raw);
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
        hasVideoSlot: raw.hasVideoSlot === true,
        hasNextVideoSlot: raw.hasNextVideoSlot === true,
        titleOnly: raw.titleOnly === true,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
    return presentScreen(row);
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
    if (typeof raw.hasVideoSlot === "boolean") data.hasVideoSlot = raw.hasVideoSlot;
    if (typeof raw.hasNextVideoSlot === "boolean") data.hasNextVideoSlot = raw.hasNextVideoSlot;
    if (typeof raw.titleOnly === "boolean") data.titleOnly = raw.titleOnly;
    if (typeof raw.sortOrder === "number" && Number.isInteger(raw.sortOrder)) data.sortOrder = raw.sortOrder;
    const row = await this.prisma.skinScreen.update({ where: { id: current.id }, data });
    return presentScreen(row);
  }

  @Delete(":screenId")
  async remove(@Param("skinId") skinId: string, @Param("screenId") screenId: string) {
    const skin = await this.loadHtmlSkin(skinId);
    const current = await this.prisma.skinScreen.findFirst({
      where: { id: screenId, skinId: skin.id },
    });
    if (!current) throw new NotFoundException("화면을 찾을 수 없어요");
    await this.prisma.skinScreen.delete({ where: { id: current.id } });
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
    return { items: rows.map(presentScreen) };
  }
}