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
  tokens: unknown;
  isActive: boolean;
  isBuiltin: boolean;
  createdAt: Date;
  _count?: { devices: number };
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    tone: row.tone,
    thumbnailUrl: row.thumbnailUrl,
    tokens: row.tokens as SkinTokens,
    isActive: row.isActive,
    isBuiltin: row.isBuiltin,
    createdAt: row.createdAt.toISOString(),
    storeCount: row._count?.devices ?? 0,
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
      include: { _count: { select: { devices: true } } },
    });
    const programUsage = await this.buildProgramUsageMap();
    return {
      items: rows.map((row) => ({
        ...present(row),
        usedInPrograms: programUsage.get(row.slug) || [],
      })),
    };
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    const row = await this.prisma.skin.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: { _count: { select: { devices: true } } },
    });
    if (!row) throw new NotFoundException("스킨을 찾을 수 없어요");
    const programUsage = await this.buildProgramUsageMap();
    return {
      ...present(row),
      usedInPrograms: programUsage.get(row.slug) || [],
    };
  }

  @Post()
  async create(@Body() body: unknown) {
    const input = this.parseBody(body);
    const existing = await this.prisma.skin.findUnique({ where: { slug: input.slug } });
    if (existing) throw new BadRequestException("이미 같은 slug의 스킨이 있어요");
    const row = await this.prisma.skin.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        tone: input.tone || "linear-gradient(135deg,#333,#666)",
        thumbnailUrl: input.thumbnailUrl,
        tokens: input.tokens || {},
        isActive: true,
        isBuiltin: false,
      },
      include: { _count: { select: { devices: true } } },
    });
    return present(row);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const current = await this.prisma.skin.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!current) throw new NotFoundException("스킨을 찾을 수 없어요");
    const raw = body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof raw.name === "string") data.name = raw.name.trim();
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

  private parseBody(body: unknown) {
    if (!body || typeof body !== "object") throw new BadRequestException("본문이 필요해요");
    const raw = body as Record<string, unknown>;
    const slug = typeof raw.slug === "string" ? raw.slug.trim().toLowerCase().replace(/\s+/g, "-") : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!slug) throw new BadRequestException("slug가 필요해요");
    if (!name) throw new BadRequestException("name이 필요해요");
    return {
      slug,
      name,
      description: typeof raw.description === "string" ? raw.description.trim() || null : null,
      tone: typeof raw.tone === "string" ? raw.tone : null,
      thumbnailUrl: typeof raw.thumbnailUrl === "string" ? raw.thumbnailUrl || null : null,
      tokens: raw.tokens && typeof raw.tokens === "object" ? raw.tokens : null,
    };
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
