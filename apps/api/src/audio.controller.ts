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
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";

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

function mediaDir() {
  return join(process.cwd(), "..", "admin", "public", "media", "audio");
}

@Controller("admin/v1/audio")
@UseGuards(AuthGuard)
export class AudioController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.audioAsset.findMany({ orderBy: { createdAt: "desc" } });
    return { items: rows.map(present) };
  }

  @Post()
  async create(@Body() body: unknown) {
    const input = parseBody(body);
    let url = input.url;
    if (input.dataBase64) {
      const id = randomUUID();
      const ext = EXT[input.mimeType] || "mp3";
      const dir = mediaDir();
      mkdirSync(dir, { recursive: true });
      const file = `${id}.${ext}`;
      writeFileSync(join(dir, file), Buffer.from(input.dataBase64, "base64"));
      url = `/media/audio/${file}`;
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
    await this.prisma.audioAsset.delete({ where: { id } });
    return { ok: true };
  }
}
