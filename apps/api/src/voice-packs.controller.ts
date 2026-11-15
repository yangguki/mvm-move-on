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
import { VOICE_CUE_KEYS, REST_CUE_KEYS, type VoiceCueKey } from "@mvn/shared";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";

type CuesMap = Partial<Record<VoiceCueKey, string>>;

function parseCues(raw: unknown): CuesMap {
  if (!raw || typeof raw !== "object") throw new BadRequestException("cues가 필요해요");
  const src = raw as Record<string, unknown>;
  const out: CuesMap = {};
  for (const key of VOICE_CUE_KEYS) {
    const id = src[key];
    if (typeof id !== "string" || !id.trim()) throw new BadRequestException(`cues.${key}가 필요해요`);
    out[key] = id.trim();
  }
  for (const key of REST_CUE_KEYS) {
    const id = src[key];
    if (typeof id === "string" && id.trim()) {
      out[key] = id.trim();
    }
  }
  return out;
}

function present(row: { id: string; name: string; isDefault: boolean; cues: unknown; createdAt: Date }) {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    cues: row.cues as CuesMap,
    createdAt: row.createdAt.toISOString(),
  };
}

@Controller("admin/v1/voice-packs")
@UseGuards(AuthGuard)
export class VoicePacksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.voicePack.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
    const usageMap = await this.buildUsageMap();
    return {
      items: rows.map((row) => ({
        ...present(row),
        usedInPrograms: usageMap.get(row.id) || [],
      })),
    };
  }

  private async buildUsageMap(): Promise<Map<string, string[]>> {
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
    const versionByProgram = new Map(versions.map((v) => [v.programId, v.snapshot as { skin?: { options?: { voicePackId?: string } } }]));

    const map = new Map<string, string[]>();
    for (const program of programs) {
      const draft = program.draft as { skin?: { options?: { voicePackId?: string } } };
      const published = versionByProgram.get(program.id);
      const vpIds = [draft?.skin?.options?.voicePackId, published?.skin?.options?.voicePackId].filter(Boolean) as string[];
      for (const vpId of vpIds) {
        const existing = map.get(vpId) || [];
        if (!existing.includes(program.name)) {
          existing.push(program.name);
          map.set(vpId, existing);
        }
      }
    }
    return map;
  }

  @Post()
  async create(@Body() body: unknown) {
    if (!body || typeof body !== "object") throw new BadRequestException("본문이 필요해요");
    const raw = body as Record<string, unknown>;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) throw new BadRequestException("name이 필요해요");
    const cues = parseCues(raw.cues);
    const isDefault = Boolean(raw.isDefault);
    if (isDefault) {
      await this.prisma.voicePack.updateMany({ data: { isDefault: false }, where: { isDefault: true } });
    }
    const row = await this.prisma.voicePack.create({
      data: { name, cues, isDefault },
    });
    return present(row);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const current = await this.prisma.voicePack.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("음성 팩을 찾을 수 없어요");
    if (!body || typeof body !== "object") throw new BadRequestException("본문이 필요해요");
    const raw = body as Record<string, unknown>;
    const name = typeof raw.name === "string" ? raw.name.trim() : current.name;
    const cues = raw.cues != null ? parseCues(raw.cues) : (current.cues as CuesMap);
    const isDefault = raw.isDefault != null ? Boolean(raw.isDefault) : current.isDefault;
    if (isDefault) {
      await this.prisma.voicePack.updateMany({ data: { isDefault: false }, where: { isDefault: true } });
    }
    const row = await this.prisma.voicePack.update({
      where: { id },
      data: { name, cues, isDefault },
    });
    return present(row);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const current = await this.prisma.voicePack.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("음성 팩을 찾을 수 없어요");

    const usedIn = await this.findVoicePackUsage(id);
    if (usedIn.length > 0) {
      throw new ConflictException({
        message: "사용 중인 음성 팩은 삭제할 수 없어요",
        programs: usedIn,
      });
    }

    await this.prisma.voicePack.delete({ where: { id } });
    return { ok: true };
  }

  private async findVoicePackUsage(voicePackId: string): Promise<string[]> {
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
    const versionByProgram = new Map(versions.map((v) => [v.programId, v.snapshot as { skin?: { options?: { voicePackId?: string } } }]));

    const usedIn: string[] = [];
    for (const program of programs) {
      const draft = program.draft as { skin?: { options?: { voicePackId?: string } } };
      const published = versionByProgram.get(program.id);
      if (draft?.skin?.options?.voicePackId === voicePackId || published?.skin?.options?.voicePackId === voicePackId) {
        usedIn.push(program.name);
      }
    }
    return usedIn;
  }
}
