import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { expand, type PublishedSnapshot } from "@mvn/shared";
import { PrismaService } from "./prisma.service";
import { DeviceAuthGuard } from "./device-auth.guard";
import { DeviceTokenService, type DeviceToken } from "./device-token.service";

@Controller("player/v1")
export class PlayerController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deviceTokens: DeviceTokenService,
  ) {}

  @Post("pair")
  async pair(@Body() body: { code?: string }) {
    const code = body.code?.trim();
    if (!code || !/^\d{6}$/.test(code)) {
      throw new BadRequestException("6자리 숫자 페어링 코드가 필요해요");
    }
    const session = await this.prisma.pairingSession.findUnique({
      where: { code },
      include: { store: true },
    });
    if (!session || session.expiresAt < new Date() || session.consumedAt) {
      throw new BadRequestException("유효하지 않거나 만료된 코드예요");
    }
    if (!session.store.isActive) {
      throw new BadRequestException("비활성 지점의 페어링 코드예요");
    }
    const deviceCode = `TV-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const defaultSkin = await this.prisma.skin.findFirst({ where: { isBuiltin: true }, orderBy: { createdAt: "asc" } });
    if (!defaultSkin) {
      throw new BadRequestException("기본 스킨이 없어요");
    }
    const [, device] = await this.prisma.$transaction([
      this.prisma.pairingSession.update({
        where: { id: session.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.device.create({
        data: {
          code: deviceCode,
          name: `${session.store.name} TV`,
          storeId: session.storeId,
          skinId: defaultSkin.id,
          status: "ok",
          statusLabel: "연결 완료",
          appVersion: "1.0.0",
          seenLabel: "방금 전",
          offline: false,
        },
      }),
    ]);
    const token = this.deviceTokens.sign(session.storeId, device.id);
    return { token };
  }

  @Get("programs")
  @UseGuards(DeviceAuthGuard)
  async list(@Req() req: { device: DeviceToken }) {
    const store = await this.prisma.store.findUnique({
      where: { id: req.device.storeId },
      include: { program: true },
    });
    if (!store || !store.isActive) {
      throw new ForbiddenException("비활성 지점이에요");
    }
    if (!store.programId || !store.program) {
      return { items: [] };
    }
    if (store.program.publishedVersion == null) {
      return { items: [] };
    }
    const version = await this.prisma.programVersion.findUnique({
      where: { programId_version: { programId: store.program.id, version: store.program.publishedVersion } },
    });
    return {
      items: [
        {
          id: store.program.id,
          name: store.program.name,
          publishedVersion: store.program.publishedVersion,
          publishedAt: version?.publishedAt?.toISOString() ?? store.program.updatedAt.toISOString(),
        },
      ],
    };
  }

  @Get("programs/:id")
  @UseGuards(DeviceAuthGuard)
  async latest(@Req() req: { device: DeviceToken }, @Param("id") id: string) {
    const store = await this.prisma.store.findUnique({ where: { id: req.device.storeId } });
    if (!store || !store.isActive) {
      throw new ForbiddenException("비활성 지점이에요");
    }
    if (store.programId !== id) {
      throw new ForbiddenException("이 지점에 지정된 프로그램이 아니에요");
    }
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program || program.publishedVersion == null) {
      throw new NotFoundException("발행된 프로그램을 찾을 수 없어요");
    }
    const version = await this.prisma.programVersion.findUnique({
      where: { programId_version: { programId: id, version: program.publishedVersion } },
    });
    if (!version) throw new NotFoundException("발행 스냅샷을 찾을 수 없어요");
    const snapshot = version.snapshot as PublishedSnapshot;
    const videos = snapshot.videos ?? {};
    return {
      ...snapshot,
      videos,
      playItems: expand(snapshot, videos),
      publishedVersion: version.version,
      publishedAt: version.publishedAt.toISOString(),
    };
  }
}
