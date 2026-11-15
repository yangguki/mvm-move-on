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
import { randomUUID } from "crypto";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";
import { StorageService } from "./storage.service";

const ALLOWED = new Set(["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/m4a"]);
const EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
};

function present(row: {
  id: string;
  name: string;
  kind: string;
  url: string;
  durationSec: number;
  mimeType: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    url: row.url,
    durationSec: row.durationSec,
    mimeType: row.mimeType,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseBody(body: unknown, opts: { enforceUploadFormat?: boolean } = {}) {
  if (!body || typeof body !== "object") throw new BadRequestException("본문이 필요해요");
  const raw = body as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const kind = raw.kind === "music" || raw.kind === "voice" ? raw.kind : "";
  if (!name) throw new BadRequestException("name이 필요해요");
  if (!kind) throw new BadRequestException("kind는 music|voice 예요");
  const durationSec = Number(raw.durationSec ?? 1);
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new BadRequestException("durationSec가 필요해요");
  const mimeType = typeof raw.mimeType === "string" ? raw.mimeType.trim() : "audio/mpeg";
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  const dataBase64 = typeof raw.dataBase64 === "string" ? raw.dataBase64 : "";
  if (opts.enforceUploadFormat !== false) {
    const okMime = ALLOWED.has(mimeType);
    const okUrl = /\.(mp3|m4a)(\?|$)/i.test(url);
    if (dataBase64 || !url) {
      if (!okMime) throw new BadRequestException("MP3/M4A만 허용해요");
    } else if (!okMime && !okUrl) {
      throw new BadRequestException("MP3/M4A만 허용해요");
    }
  }
  return { name, kind, durationSec: Math.round(durationSec), mimeType, url, dataBase64 };
}

@Controller("admin/v1/audio")
@UseGuards(AuthGuard)
export class AudioController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async list() {
    const rows = await this.prisma.audioAsset.findMany({ orderBy: { createdAt: "desc" } });
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
    const versionByProgram = new Map(versions.map((v) => [v.programId, v.snapshot as { skin?: { options?: { musicId?: string } } }]));
    const packs = await this.prisma.voicePack.findMany({ select: { cues: true } });
    const audioIdsInPacks = new Set<string>();
    for (const pack of packs) {
      const cues = pack.cues as Record<string, string>;
      for (const id of Object.values(cues)) audioIdsInPacks.add(id);
    }

    const map = new Map<string, string[]>();
    for (const program of programs) {
      const draft = program.draft as { skin?: { options?: { musicId?: string } } };
      const published = versionByProgram.get(program.id);
      const musicIds = [draft?.skin?.options?.musicId, published?.skin?.options?.musicId].filter(Boolean) as string[];
      for (const musicId of musicIds) {
        const existing = map.get(musicId) || [];
        if (!existing.includes(program.name)) {
          existing.push(program.name);
          map.set(musicId, existing);
        }
      }
    }
    for (const audioId of audioIdsInPacks) {
      if (!map.has(audioId)) map.set(audioId, ["음성 팩"]);
      else if (!map.get(audioId)!.includes("음성 팩")) map.get(audioId)!.push("음성 팩");
    }
    return map;
  }

  @Post()
  async create(@Body() body: unknown) {
    const input = parseBody(body);
    let url = input.url;
    let storageKey: string | undefined;
    if (input.dataBase64) {
      const id = randomUUID();
      const ext = EXT[input.mimeType] || "mp3";
      storageKey = `audio/${id}.${ext}`;
      url = await this.storage.upload(storageKey, Buffer.from(input.dataBase64, "base64"), input.mimeType);
    }
    if (!url) throw new BadRequestException("url 또는 dataBase64가 필요해요");
    if (!/\.(mp3|m4a)(\?|$)/i.test(url) && !ALLOWED.has(input.mimeType)) {
      throw new BadRequestException("MP3/M4A만 허용해요");
    }
    const row = await this.prisma.audioAsset.create({
      data: {
        name: input.name,
        kind: input.kind,
        url,
        durationSec: input.durationSec,
        mimeType: input.mimeType.startsWith("audio/") ? input.mimeType : "audio/mpeg",
        storageKey,
      },
    });
    return present(row);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const current = await this.prisma.audioAsset.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("오디오를 찾을 수 없어요");
    const merged = { ...present(current), ...(typeof body === "object" && body ? body : {}) };
    const input = parseBody({ ...merged, dataBase64: undefined }, { enforceUploadFormat: false });
    const row = await this.prisma.audioAsset.update({
      where: { id },
      data: {
        name: input.name,
        kind: input.kind,
        url: input.url || current.url,
        durationSec: input.durationSec,
        mimeType: input.mimeType,
      },
    });
    return present(row);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const current = await this.prisma.audioAsset.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("오디오를 찾을 수 없어요");

    const usedIn = await this.findAudioUsage(id);
    if (usedIn.length > 0) {
      throw new ConflictException({
        message: "사용 중인 오디오는 삭제할 수 없어요",
        programs: usedIn,
      });
    }

    if (current.storageKey) {
      await this.storage.delete(current.storageKey);
    }
    await this.prisma.audioAsset.delete({ where: { id } });
    return { ok: true };
  }

  private async findAudioUsage(audioId: string): Promise<string[]> {
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
    const versionByProgram = new Map(versions.map((v) => [v.programId, v.snapshot as { skin?: { options?: { musicId?: string } } }]));

    const usedIn: string[] = [];
    for (const program of programs) {
      const draft = program.draft as { skin?: { options?: { musicId?: string } } };
      const published = versionByProgram.get(program.id);
      if (draft?.skin?.options?.musicId === audioId || published?.skin?.options?.musicId === audioId) {
        usedIn.push(program.name);
      }
    }
    return usedIn;
  }
}
