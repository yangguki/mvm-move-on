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
import { VOICE_CUE_KEYS, type VoiceCueKey } from "@mvn/shared";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";

type CuesMap = Record<VoiceCueKey, string>;

function parseCues(raw: unknown): CuesMap {
  if (!raw || typeof raw !== "object") throw new BadRequestException("cues가 필요해요");
  const src = raw as Record<string, unknown>;
  const out = {} as CuesMap;
  for (const key of VOICE_CUE_KEYS) {
    const id = src[key];
    if (typeof id !== "string" || !id.trim()) throw new BadRequestException(`cues.${key}가 필요해요`);
    out[key] = id.trim();
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
    return { items: rows.map(present) };
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
    await this.prisma.voicePack.delete({ where: { id } });
    return { ok: true };
  }
}
