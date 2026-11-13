import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";

const KINDS = new Set(["countdown", "exercise", "rest"]);

type StepInput = {
  kind?: string;
  label?: string;
  subtitle?: string | null;
  seconds?: number;
  groupKey?: string | null;
  groupLabel?: string | null;
  groupRepeat?: number | null;
};

type SaveBody = {
  name?: string;
  skinId?: string;
  steps?: StepInput[];
};

type StepRow = {
  id: string;
  position: number;
  kind: string;
  label: string;
  subtitle: string | null;
  seconds: number;
  groupKey: string | null;
  groupLabel: string | null;
  groupRepeat: number | null;
};

function presentStep(step: StepRow) {
  return {
    id: step.id,
    position: step.position,
    kind: step.kind,
    label: step.label,
    subtitle: step.subtitle,
    seconds: step.seconds,
    group: step.groupKey
      ? { key: step.groupKey, label: step.groupLabel, repeat: step.groupRepeat }
      : null,
  };
}

function totals(steps: Array<{ kind: string; seconds: number }>) {
  return {
    stepCount: steps.length,
    seconds: steps.reduce((sum, step) => sum + step.seconds, 0),
    exerciseSeconds: steps.filter((step) => step.kind === "exercise").reduce((sum, step) => sum + step.seconds, 0),
    restSeconds: steps.filter((step) => step.kind === "rest").reduce((sum, step) => sum + step.seconds, 0),
  };
}

function presentProgram(program: {
  id: string;
  name: string;
  status: string;
  lockVersion: number;
  draftVersion: number;
  publishedVersion: number | null;
  updatedAt: Date;
  skin: { id: string; name: string; slug: string; tone: string };
  steps: StepRow[];
}) {
  return {
    id: program.id,
    name: program.name,
    status: program.status,
    lockVersion: program.lockVersion,
    draftVersion: program.draftVersion,
    publishedVersion: program.publishedVersion,
    updatedAt: program.updatedAt,
    skin: program.skin,
    totals: totals(program.steps),
    steps: program.steps.map(presentStep),
  };
}

function normalizeSteps(steps: StepInput[]) {
  return steps.map((step, index) => {
    const kind = step.kind ?? "";
    const label = step.label?.trim() ?? "";
    if (!KINDS.has(kind)) throw new BadRequestException("단계 종류는 countdown, exercise, rest 중 하나예요");
    if (!label) throw new BadRequestException("단계 이름이 필요해요");
    if (!Number.isInteger(step.seconds) || (step.seconds ?? 0) <= 0) {
      throw new BadRequestException("단계 시간은 1초 이상이어야 해요");
    }
    return {
      position: index + 1,
      kind,
      label,
      subtitle: step.subtitle?.trim() || null,
      seconds: step.seconds as number,
      groupKey: step.groupKey?.trim() || null,
      groupLabel: step.groupLabel?.trim() || null,
      groupRepeat: step.groupRepeat ?? null,
    };
  });
}

@Controller("admin/v1/programs")
@UseGuards(AuthGuard)
export class ProgramsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.program.findMany({
      include: { skin: true, steps: { orderBy: { position: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
    return {
      items: rows.map((program) => ({
        id: program.id,
        name: program.name,
        status: program.status,
        lockVersion: program.lockVersion,
        draftVersion: program.draftVersion,
        publishedVersion: program.publishedVersion,
        totals: totals(program.steps),
        skin: { id: program.skin.id, name: program.skin.name, slug: program.skin.slug, tone: program.skin.tone },
      })),
    };
  }

  @Post()
  async create(@Body() body: { name?: string; skinId?: string }) {
    const name = body.name?.trim() ?? "";
    if (!name || !body.skinId) throw new BadRequestException("프로그램 이름과 스킨이 필요해요");
    const skin = await this.prisma.skin.findUnique({ where: { id: body.skinId } });
    if (!skin) throw new NotFoundException("스킨을 찾을 수 없어요");
    const program = await this.prisma.program.create({
      data: { name, skinId: skin.id, status: "draft" },
      include: { skin: true, steps: { orderBy: { position: "asc" } } },
    });
    return presentProgram(program);
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    return presentProgram(await this.load(id));
  }

  @Put(":id")
  async save(@Param("id") id: string, @Headers("if-match") ifMatch: string | undefined, @Body() body: SaveBody) {
    const current = await this.load(id);
    this.assertLock(current.lockVersion, ifMatch);
    const name = body.name?.trim() ?? "";
    if (!name || !body.skinId || !Array.isArray(body.steps)) {
      throw new BadRequestException("이름, 스킨, 단계 목록이 필요해요");
    }
    const skin = await this.prisma.skin.findUnique({ where: { id: body.skinId } });
    if (!skin) throw new NotFoundException("스킨을 찾을 수 없어요");
    const steps = normalizeSteps(body.steps);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.program.updateMany({
        where: { id, lockVersion: current.lockVersion },
        data: {
          name,
          skinId: skin.id,
          status: "draft",
          draftVersion: { increment: 1 },
          lockVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException("다른 저장이 먼저 반영됐어요. 다시 불러와 주세요");
      await tx.programStep.deleteMany({ where: { programId: id } });
      if (steps.length > 0) await tx.programStep.createMany({ data: steps.map((step) => ({ ...step, programId: id })) });
    });
    return presentProgram(await this.load(id));
  }

  @Post(":id/publish")
  async publish(@Param("id") id: string, @Headers("if-match") ifMatch: string | undefined) {
    const current = await this.load(id);
    this.assertLock(current.lockVersion, ifMatch);
    if (current.publishedVersion === current.draftVersion) {
      throw new ConflictException("이 초안은 이미 발행됐어요");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.programVersion.create({
        data: {
          programId: id,
          version: current.draftVersion,
          name: current.name,
          skinId: current.skinId,
          steps: {
            create: current.steps.map((step) => ({
              position: step.position,
              kind: step.kind,
              label: step.label,
              subtitle: step.subtitle,
              seconds: step.seconds,
              groupKey: step.groupKey,
              groupLabel: step.groupLabel,
              groupRepeat: step.groupRepeat,
            })),
          },
        },
      });
      const updated = await tx.program.updateMany({
        where: { id, lockVersion: current.lockVersion },
        data: {
          status: "published",
          publishedVersion: current.draftVersion,
          lockVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException("다른 저장이 먼저 반영됐어요. 다시 불러와 주세요");
    });
    return presentProgram(await this.load(id));
  }

  @Get(":id/versions")
  async versions(@Param("id") id: string) {
    await this.load(id);
    const rows = await this.prisma.programVersion.findMany({
      where: { programId: id },
      include: { skin: true, _count: { select: { steps: true } } },
      orderBy: { version: "desc" },
    });
    return {
      items: rows.map((version) => ({
        id: version.id,
        version: version.version,
        name: version.name,
        createdAt: version.createdAt,
        stepCount: version._count.steps,
        skin: { id: version.skin.id, name: version.skin.name },
      })),
    };
  }

  private assertLock(lockVersion: number, ifMatch?: string) {
    const match = ifMatch?.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
    if (!match) throw new BadRequestException("If-Match 헤더에 lockVersion이 필요해요");
    if (match !== String(lockVersion)) {
      throw new ConflictException("다른 저장이 먼저 반영됐어요. 다시 불러와 주세요");
    }
  }

  private async load(id: string) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      include: { skin: true, steps: { orderBy: { position: "asc" } } },
    });
    if (!program) throw new NotFoundException("프로그램을 찾을 수 없어요");
    return program;
  }
}
