import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { randomInt } from "crypto";
import { assertHq, AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";
import type { AccessToken } from "./token.service";

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

@Controller("admin/v1")
@UseGuards(AuthGuard)
export class OperationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("stores")
  async createStore(@Req() request: { user: AccessToken }, @Body() body: { name?: string; code?: string }) {
    assertHq(request.user);
    const name = body.name?.trim() ?? "";
    const code = body.code?.trim().toUpperCase() ?? "";
    if (!name || !code) throw new BadRequestException("지점 이름과 코드가 필요해요");
    try {
      const store = await this.prisma.store.create({ data: { name, code } });
      return { id: store.id, name: store.name, code: store.code, tvCount: 0, online: 0, offline: 0, programName: null, skin: null, state: "ok" };
    } catch (error) {
      if (isUnique(error)) throw new ConflictException("이미 있는 지점 코드예요");
      throw error;
    }
  }

  @Patch("stores/:id")
  async updateStore(
    @Req() request: { user: AccessToken },
    @Param("id") id: string,
    @Body() body: { name?: string },
  ) {
    assertHq(request.user);
    const name = body.name?.trim() ?? "";
    if (!name) throw new BadRequestException("지점 이름이 필요해요");
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException("지점을 찾을 수 없어요");
    const updated = await this.prisma.store.update({ where: { id }, data: { name } });
    return { id: updated.id, name: updated.name, code: updated.code };
  }

  @Patch("devices/:id")
  async updateDevice(
    @Param("id") id: string,
    @Body() body: { name?: string; videoLoopMode?: string },
  ) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException("TV를 찾을 수 없어요");
    if (body.videoLoopMode && body.videoLoopMode !== "ab" && body.videoLoopMode !== "single") {
      throw new BadRequestException("영상 반복은 ab 또는 single 이에요");
    }
    const name = body.name?.trim();
    const updated = await this.prisma.device.update({
      where: { id },
      data: {
        name: name || undefined,
        videoLoopMode: body.videoLoopMode,
      },
      include: { store: true, skin: true },
    });
    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      videoLoopMode: updated.videoLoopMode,
      store: { id: updated.store.id, name: updated.store.name, code: updated.store.code },
      skin: { id: updated.skin.id, name: updated.skin.name },
    };
  }

  @Post("pairing-sessions")
  async pair(@Body() body: { storeId?: string }) {
    if (!body.storeId) throw new BadRequestException("지점이 필요해요");
    const store = await this.prisma.store.findUnique({ where: { id: body.storeId } });
    if (!store) throw new NotFoundException("지점을 찾을 수 없어요");
    await this.prisma.pairingSession.deleteMany({ where: { expiresAt: { lt: new Date() }, consumedAt: null } });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      try {
        const session = await this.prisma.pairingSession.create({
          data: {
            storeId: store.id,
            code,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
        return { id: session.id, code: session.code, expiresAt: session.expiresAt, store: { id: store.id, name: store.name, code: store.code } };
      } catch (error) {
        if (!isUnique(error)) throw error;
      }
    }
    throw new ConflictException("연결 코드를 만들지 못했어요. 다시 시도해 주세요");
  }
}
