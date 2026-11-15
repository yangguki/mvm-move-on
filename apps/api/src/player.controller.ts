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
import { randomInt } from "crypto";
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

  @Post("code")
  async requestCode() {
    await this.prisma.pairingSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      try {
        const session = await this.prisma.pairingSession.create({
          data: {
            code,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
        return { code: session.code, expiresAt: session.expiresAt.toISOString() };
      } catch {
        continue;
      }
    }
    throw new BadRequestException("코드를 생성하지 못했어요. 다시 시도해 주세요");
  }

  @Get("code/:code/status")
  async checkCode(@Param("code") code: string) {
    const session = await this.prisma.pairingSession.findUnique({ where: { code } });
    if (!session) {
      throw new NotFoundException("코드를 찾을 수 없어요");
    }
    if (session.expiresAt < new Date()) {
      return { status: "expired" };
    }
    if (session.approvedAt && session.deviceId) {
      const token = this.deviceTokens.sign(session.storeId ?? "", session.deviceId);
      await this.prisma.pairingSession.update({
        where: { id: session.id },
        data: { consumedAt: new Date() },
      });
      return { status: "approved", token };
    }
    return { status: "pending", expiresAt: session.expiresAt.toISOString() };
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
