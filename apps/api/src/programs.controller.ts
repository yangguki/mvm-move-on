import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  collectVideoRefs,
  expand,
  playTotalSec,
  validateProgram,
  type Program as SharedProgram,
  type PublishedSnapshot,
  type Video,
  type VideoMap,
} from "@mvn/shared";
import { resolveProgramSkin } from "./audio-resolve";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";

function presentVideo(row: {
  id: string;
  name: string;
  url: string;
  durationSec: number;
  thumbnailUrl: string;
  width: number;
  height: number;
}): Video {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    durationSec: row.durationSec,
    thumbnailUrl: row.thumbnailUrl,
    width: row.width,
    height: row.height,
  };
}

async function freezeVideos(prisma: PrismaService, items: SharedProgram["items"]): Promise<VideoMap> {
  const refs = collectVideoRefs(items);
  if (!refs.length) return {};
  const ids = [...new Set(refs.map((ref) => ref.videoId))];
  const rows = await prisma.video.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((row) => [row.id, presentVideo(row)]));
  const missing = refs.filter((ref) => !byId.has(ref.videoId));
  if (missing.length) {
    const detail = missing.map((ref) => `${ref.path}(videoId=${ref.videoId})`).join(", ");
    throw new BadRequestException(`존재하지 않는 영상이 있어요: ${detail}`);
  }
  const videos: VideoMap = {};
  for (const id of ids) videos[id] = byId.get(id)!;
  return videos;
}

type DraftBody = {
  items?: unknown;
  skin?: unknown;
};

function asDraft(raw: unknown): { items: SharedProgram["items"]; skin: SharedProgram["skin"] } {
  try {
    const checked = validateProgram({
      id: "draft",
      name: "tmp",
      status: "draft",
      draftUpdatedAt: new Date().toISOString(),
      publishedVersion: null,
      ...(typeof raw === "object" && raw ? raw : {}),
    });
    return { items: checked.items, skin: checked.skin };
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : "프로그램 draft가 올바르지 않아요");
  }
}

function present(row: {
  id: string;
  name: string;
  status: string;
  draft: unknown;
  draftUpdatedAt: Date;
  publishedVersion: number | null;
}): SharedProgram & { totals: { seconds: number; stepCount: number } } {
  const draft = row.draft as { items: SharedProgram["items"]; skin: SharedProgram["skin"] };
  const program: SharedProgram = {
    id: row.id,
    name: row.name,
    status: row.status === "published" ? "published" : "draft",
    draftUpdatedAt: row.draftUpdatedAt.toISOString(),
    publishedVersion: row.publishedVersion,
    skin: draft.skin,
    items: draft.items,
  };
  const play = expand(program);
  return {
    ...program,
    totals: { seconds: playTotalSec(play), stepCount: play.length },
  };
}

@Controller("admin/v1/programs")
@UseGuards(AuthGuard)
export class ProgramsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.program.findMany({ orderBy: { updatedAt: "desc" } });
    return { items: rows.map(present) };
  }

  @Post()
  async create(@Body() body: { name?: string; draft?: DraftBody }) {
    const name = body.name?.trim() ?? "";
    if (!name) throw new BadRequestException("프로그램 이름이 필요해요");
    const draft = asDraft({
      name,
      status: "draft",
      items: body.draft?.items ?? [{ id: "guide-1", type: "guide", durationSec: 10, label: "시작 카운트다운" }],
      skin: body.draft?.skin ?? {
        id: "neon-arcade",
        options: { pointColor: "#C8F31D", nextLeadSec: 10 },
      },
    });
    const row = await this.prisma.program.create({
      data: { name, status: "draft", draft, draftUpdatedAt: new Date() },
    });
    return present(row);
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    return present(await this.load(id));
  }

  @Put(":id")
  async save(@Param("id") id: string, @Body() body: { name?: string; draft?: DraftBody; items?: unknown; skin?: unknown }) {
    const current = await this.load(id);
    const name = body.name?.trim() || current.name;
    const incoming = body.draft ?? { items: body.items, skin: body.skin };
    const draft = asDraft({
      name,
      status: "draft",
      items: incoming.items ?? (current.draft as DraftBody).items,
      skin: incoming.skin ?? (current.draft as DraftBody).skin,
    });
    const row = await this.prisma.program.update({
      where: { id },
      data: {
        name,
        status: "draft",
        draft,
        draftUpdatedAt: new Date(),
      },
    });
    return present(row);
  }

  @Post(":id/publish")
  async publish(@Param("id") id: string) {
    const current = await this.load(id);
    const draft = current.draft as { items: SharedProgram["items"]; skin: SharedProgram["skin"] };
    const nextVersion = (current.publishedVersion ?? 0) + 1;
    const skin = await resolveProgramSkin(this.prisma, draft.skin);
    const videos = await freezeVideos(this.prisma, draft.items);
    const base = validateProgram({
      id: current.id,
      name: current.name,
      status: "published",
      draftUpdatedAt: current.draftUpdatedAt.toISOString(),
      publishedVersion: nextVersion,
      skin,
      items: draft.items,
    });
    const snapshot: PublishedSnapshot = { ...base, videos };
    await this.prisma.$transaction(async (tx) => {
      await tx.programVersion.create({
        data: {
          programId: id,
          version: nextVersion,
          snapshot,
        },
      });
      await tx.program.update({
        where: { id },
        data: {
          status: "published",
          publishedVersion: nextVersion,
        },
      });
    });
    return present(await this.load(id));
  }

  @Get(":id/versions")
  async versions(@Param("id") id: string) {
    await this.load(id);
    const rows = await this.prisma.programVersion.findMany({
      where: { programId: id },
      orderBy: { version: "desc" },
    });
    return {
      items: rows.map((version) => {
        const snap = version.snapshot as PublishedSnapshot;
        return {
          id: version.id,
          version: version.version,
          name: snap.name,
          publishedAt: version.publishedAt,
          stepCount: expand(snap, snap.videos ?? {}).length,
          skin: snap.skin,
        };
      }),
    };
  }

  private async load(id: string) {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program) throw new NotFoundException("프로그램을 찾을 수 없어요");
    return program;
  }
}
