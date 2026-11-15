import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { validateVideoInput } from "@mvn/shared";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";
import { VideoQueueService } from "./video-queue.service";
import { StorageService } from "./storage.service";

const ALLOWED_MIMES = ["video/mp4", "video/quicktime", "video/webm", "image/gif"];
const ALLOWED_EXTS = [".mp4", ".mov", ".webm", ".gif"];
const MAX_SIZE = 100 * 1024 * 1024;

type VideoRow = {
  id: string;
  name: string;
  url: string;
  durationSec: number;
  thumbnailUrl: string;
  width: number;
  height: number;
  status: string;
  sourceType: string;
  error: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  createdAt: Date;
};

function present(video: VideoRow) {
  return {
    id: video.id,
    name: video.name,
    url: video.url,
    durationSec: video.durationSec,
    thumbnailUrl: video.thumbnailUrl,
    width: video.width,
    height: video.height,
    status: video.status,
    sourceType: video.sourceType,
    error: video.error,
    sizeBytes: video.sizeBytes,
    createdAt: video.createdAt.toISOString(),
  };
}

@Controller("admin/v1/videos")
@UseGuards(AuthGuard)
export class VideosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: VideoQueueService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async list() {
    const rows = await this.prisma.video.findMany({ orderBy: { createdAt: "desc" } });
    return { items: rows.map(present) };
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const row = await this.prisma.video.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("영상을 찾을 수 없어요");
    return present(row);
  }

  @Post()
  async create(@Body() body: unknown) {
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
        status: "ready",
        sourceType: "url",
      },
    });
    return present(row);
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_SIZE })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body() body: { name?: string },
  ) {
    const ext = (file.originalname.match(/\.[^.]+$/) || [""])[0].toLowerCase();
    if (!ALLOWED_EXTS.includes(ext) && !ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException("MP4, MOV, WebM, GIF 파일만 업로드할 수 있어요");
    }

    const name = body.name?.trim() || file.originalname.replace(/\.[^.]+$/, "");

    const row = await this.prisma.video.create({
      data: {
        name,
        url: "",
        durationSec: 0,
        thumbnailUrl: "",
        width: 0,
        height: 0,
        status: "uploading",
        sourceType: "upload",
        sizeBytes: file.size,
      },
    });

    await this.queue.enqueue(row.id, file.buffer, file.originalname);

    return present(row);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const current = await this.prisma.video.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("영상을 찾을 수 없어요");
    const currentPresent = present(current);
    let input;
    try {
      input = validateVideoInput({ ...currentPresent, ...(typeof body === "object" && body ? body : {}) });
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

    const programs = await this.prisma.program.findMany({
      where: { publishedVersion: null },
      select: { id: true, draft: true },
    });

    for (const prog of programs) {
      const draft = prog.draft as { items?: Array<{ videoId?: string; steps?: Array<{ videoId?: string }> }> };
      if (!draft?.items) continue;
      for (const item of draft.items) {
        if (item.videoId === id) {
          throw new ConflictException("작업 중인 프로그램에서 사용 중인 영상은 삭제할 수 없어요");
        }
        if (item.steps) {
          for (const step of item.steps) {
            if (step.videoId === id) {
              throw new ConflictException("작업 중인 프로그램에서 사용 중인 영상은 삭제할 수 없어요");
            }
          }
        }
      }
    }

    if (current.storageKey) {
      try {
        await this.storage.delete(current.storageKey);
        const thumbKey = current.storageKey.replace(/\.mp4$/, "_thumb.jpg");
        await this.storage.delete(thumbKey);
      } catch {
        // ignore storage errors
      }
    }

    await this.prisma.video.delete({ where: { id } });
    return { ok: true };
  }
}
