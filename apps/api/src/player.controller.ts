import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { expand, type PublishedSnapshot } from "@mvn/shared";
import { PrismaService } from "./prisma.service";
import { DeviceAuthGuard } from "./device-auth.guard";
import { DeviceTokenService } from "./device-token.service";

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
    const session = await this.prisma.pairingSession.findUnique({ where: { code } });
    if (!session || session.expiresAt < new Date() || session.consumedAt) {
      throw new BadRequestException("유효하지 않거나 만료된 코드예요");
    }
    const deviceId = `device-${Date.now().toString(36)}`;
    await this.prisma.pairingSession.update({
      where: { id: session.id },
      data: { consumedAt: new Date() },
    });
    const token = this.deviceTokens.sign(session.storeId, deviceId);
    return { token };
  }

  @Get("programs")
  @UseGuards(DeviceAuthGuard)
  async list() {
    const programs = await this.prisma.program.findMany({
      where: { publishedVersion: { not: null } },
      orderBy: { updatedAt: "desc" },
    });
    const items = await Promise.all(
      programs.map(async (prog) => {
        const version = await this.prisma.programVersion.findUnique({
          where: { programId_version: { programId: prog.id, version: prog.publishedVersion! } },
        });
        return {
          id: prog.id,
          name: prog.name,
          publishedVersion: prog.publishedVersion,
          publishedAt: version?.publishedAt?.toISOString() ?? prog.updatedAt.toISOString(),
        };
      }),
    );
    return { items };
  }

  @Get("programs/:id")
  @UseGuards(DeviceAuthGuard)
  async latest(@Param("id") id: string) {
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
