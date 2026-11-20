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
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { findFreeSlug, parseSkinCreateBody, SKIN_NAME_MAX_LENGTH, SkinCreateBodyError } from "./skin-create";
import { PrismaService } from "./prisma.service";

type SkinTokens = {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  textMuted?: string;
  fontFamily?: string;
  borderRadius?: number;
  videoRadius?: number;
};

function present(row: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tone: string;
  thumbnailUrl: string | null;
  kind: string;
  tokens: unknown;
  isActive: boolean;
  isBuiltin: boolean;
  createdAt: Date;
  _count?: { devices: number };
  screenCount?: number;
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    tone: row.tone,
    thumbnailUrl: row.thumbnailUrl,
    kind: row.kind,
    tokens: row.tokens as SkinTokens,
    isActive: row.isActive,
    isBuiltin: row.isBuiltin,
    createdAt: row.createdAt.toISOString(),
    storeCount: row._count?.devices ?? 0,
    screenCount: row.screenCount,
  };
}

@Controller("admin/v1/skins")
@UseGuards(AuthGuard)
export class SkinsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.skin.findMany({
      orderBy: [{ isBuiltin: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { devices: true, screens: true } },
        screens: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: {
            id: true,
            title: true,
            html: true,
            css: true,
            hasVideoSlot: true,
            hasNextVideoSlot: true,
            titleOnly: true,
            version: true,
          },
        },
      },
    });
    const programUsage = await this.buildProgramUsageMap();
    return {
      items: rows.map((row) => {
        const programs = programUsage.get(row.slug) || [];
        const first = row.screens[0];
        const previewScreen =
          row.kind === "html" && first
            ? {
                id: first.id,
                title: first.title,
                html: first.html,
                css: first.css,
                hasVideoSlot: first.hasVideoSlot,
                hasNextVideoSlot: first.hasNextVideoSlot,
                titleOnly: first.titleOnly,
                version: first.version,
              }
            : null;
        return {
          ...present({ ...row, screenCount: row._count.screens }),
          usedInPrograms: programs,
          programCount: programs.length,
          previewScreen,
        };
      }),
    };
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    const row = await this.prisma.skin.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: { _count: { select: { devices: true, screens: true } } },
    });
    if (!row) throw new NotFoundException("스킨을 찾을 수 없어요");
    const programUsage = await this.buildProgramUsageMap();
    return {
      ...present({ ...row, screenCount: row._count.screens }),
      usedInPrograms: programUsage.get(row.slug) || [],
    };
  }

  @Post()
  async create(@Body() body: unknown) {
    let input;
    try {
      input = parseSkinCreateBody(body);
    } catch (error) {
      if (error instanceof SkinCreateBodyError) throw new BadRequestException(error.message);
      throw error;
    }
    const slugTaken = async (candidate: string) =>
      !!(await this.prisma.skin.findUnique({ where: { slug: candidate } }));
    let slug = input.slug;
    if (input.slugWasExplicit) {
      if (await slugTaken(slug)) throw new BadRequestException("이미 같은 slug의 스킨이 있어요");
    } else {
      const occupied = new Set<string>();
      while (true) {
        const candidate = findFreeSlug(input.slug, (s) => occupied.has(s));
        if (!(await slugTaken(candidate))) {
          slug = candidate;
          break;
        }
        occupied.add(candidate);
      }
    }
    const row = await this.prisma.skin.create({
      data: {
        slug,
        name: input.name,
        description: input.description,
        tone: input.tone || "linear-gradient(135deg,#333,#666)",
        thumbnailUrl: input.thumbnailUrl,
        kind: input.kind === "html" ? "html" : "tokens",
        tokens: input.kind === "html" ? {} : input.tokens || {},
        isActive: true,
        isBuiltin: false,
      },
      include: { _count: { select: { devices: true, screens: true } } },
    });
    return present({ ...row, screenCount: row._count.screens });
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const current = await this.prisma.skin.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!current) throw new NotFoundException("스킨을 찾을 수 없어요");
    const raw = body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof raw.name === "string") {
      const name = raw.name.trim();
      if (!name) throw new BadRequestException("name이 필요해요");
      if (name.length > SKIN_NAME_MAX_LENGTH) {
        throw new BadRequestException(`name은 ${SKIN_NAME_MAX_LENGTH}자 이하여야 해요`);
      }
      data.name = name;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException("변경할 항목이 없어요");
    if (typeof raw.description === "string") data.description = raw.description.trim() || null;
    if (typeof raw.tone === "string") data.tone = raw.tone;
    if (typeof raw.thumbnailUrl === "string") data.thumbnailUrl = raw.thumbnailUrl || null;
    if (raw.tokens && typeof raw.tokens === "object") data.tokens = raw.tokens;
    if (typeof raw.isActive === "boolean") data.isActive = raw.isActive;
    const row = await this.prisma.skin.update({
      where: { id: current.id },
      data,
      include: { _count: { select: { devices: true } } },
    });
    return present(row);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const current = await this.prisma.skin.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: { _count: { select: { devices: true } } },
    });
    if (!current) throw new NotFoundException("스킨을 찾을 수 없어요");
    if (current.isBuiltin) {
      throw new ConflictException({ message: "기본 스킨은 삭제할 수 없어요" });
    }
    const usedIn = await this.findSkinUsage(current.slug);
    if (usedIn.length > 0 || current._count.devices > 0) {
      throw new ConflictException({
        message: "사용 중인 스킨은 삭제할 수 없어요",
        programs: usedIn,
        deviceCount: current._count.devices,
      });
    }
    await this.prisma.skin.delete({ where: { id: current.id } });
    return { ok: true };
  }

  private async findSkinUsage(skinSlug: string): Promise<string[]> {
    const programs = await this.prisma.program.findMany({
      select: { id: true, name: true, draft: true, publishedVersion: true },
    });
    const versions = await this.prisma.programVersion.findMany({
      where: {
        programId: { in: programs.filter((p) => p.publishedVersion).map((p) => p.id) },
        version: { in: programs.filter((p) => p.publishedVersion).map((p) => p.publishedVersion!) },
      },
      select: { programId: true, snapshot: true },
    });
    const versionByProgram = new Map(versions.map((v) => [v.programId, v.snapshot as { skin?: { id?: string } }]));
    const usedIn: string[] = [];
    for (const program of programs) {
      const draft = program.draft as { skin?: { id?: string } };
      const published = versionByProgram.get(program.id);
      if (draft?.skin?.id === skinSlug || published?.skin?.id === skinSlug) {
        usedIn.push(program.name);
      }
    }
    return usedIn;
  }

  private async buildProgramUsageMap(): Promise<Map<string, string[]>> {
    const programs = await this.prisma.program.findMany({
      select: { id: true, name: true, draft: true, publishedVersion: true },
    });
    const versions = await this.prisma.programVersion.findMany({
      where: {
        programId: { in: programs.filter((p) => p.publishedVersion).map((p) => p.id) },
        version: { in: programs.filter((p) => p.publishedVersion).map((p) => p.publishedVersion!) },
      },
      select: { programId: true, snapshot: true },
    });
    const versionByProgram = new Map(versions.map((v) => [v.programId, v.snapshot as { skin?: { id?: string } }]));
    const map = new Map<string, string[]>();
    for (const program of programs) {
      const draft = program.draft as { skin?: { id?: string } };
      const published = versionByProgram.get(program.id);
      const slugs = [draft?.skin?.id, published?.skin?.id].filter(Boolean) as string[];
      for (const slug of slugs) {
        const existing = map.get(slug) || [];
        if (!existing.includes(program.name)) {
          existing.push(program.name);
          map.set(slug, existing);
        }
      }
    }
    return map;
  }
}
