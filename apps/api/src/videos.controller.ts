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
import { validateVideoInput } from "@mvn/shared";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";

function present(video: {
  id: string;
  name: string;
  url: string;
  durationSec: number;
  thumbnailUrl: string;
  width: number;
  height: number;
  createdAt: Date;
}) {
  return {
    id: video.id,
    name: video.name,
    url: video.url,
    durationSec: video.durationSec,
    thumbnailUrl: video.thumbnailUrl,
    width: video.width,
    height: video.height,
    createdAt: video.createdAt.toISOString(),
  };
}

@Controller("admin/v1/videos")
@UseGuards(AuthGuard)
export class VideosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.video.findMany({ orderBy: { createdAt: "desc" } });
    return { items: rows.map(present) };
  }

  @Post()
  async create(@Body() body: unknown) {
    // TODO: GIF 업로드 → mp4 변환. 지금은 외부 URL 등록만.
    let input;
    try {
      input = validateVideoInput(body);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "영상 정보가 올바르지 않아요");
    }
    const row = await this.prisma.video.create({
      data: {
        name: input.name,
        url: input.url,
        durationSec: input.durationSec,
        thumbnailUrl: input.thumbnailUrl,
        width: input.width,
        height: input.height,
      },
    });
    return present(row);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const current = await this.prisma.video.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("영상을 찾을 수 없어요");
    let input;
    try {
      input = validateVideoInput({ ...present(current), ...(typeof body === "object" && body ? body : {}) });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "영상 정보가 올바르지 않아요");
    }
    const row = await this.prisma.video.update({
      where: { id },
      data: {
        name: input.name,
        url: input.url,
        durationSec: input.durationSec,
        thumbnailUrl: input.thumbnailUrl,
        width: input.width,
        height: input.height,
      },
    });
    return present(row);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const current = await this.prisma.video.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("영상을 찾을 수 없어요");
    await this.prisma.video.delete({ where: { id } });
    return { ok: true };
  }
}
