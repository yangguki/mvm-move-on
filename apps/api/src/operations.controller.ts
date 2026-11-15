import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
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
    @Body() body: { name?: string; isActive?: boolean; programId?: string | null },
  ) {
    assertHq(request.user);
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException("지점을 찾을 수 없어요");
    const data: { name?: string; isActive?: boolean; programId?: string | null } = {};
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) throw new BadRequestException("지점 이름이 필요해요");
      data.name = name;
    }
    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }
    if (body.programId !== undefined) {
      if (body.programId === null) {
        data.programId = null;
      } else if (typeof body.programId === "string") {
        const program = await this.prisma.program.findUnique({ where: { id: body.programId } });
        if (!program) throw new NotFoundException("프로그램을 찾을 수 없어요");
        if (program.status !== "published") throw new BadRequestException("게시된 프로그램만 지정할 수 있어요");
        data.programId = body.programId;
      }
    }
    const updated = await this.prisma.store.update({
      where: { id },
      data,
      include: { program: true },
    });
    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      isActive: updated.isActive,
      programId: updated.programId,
      program: updated.program ? { id: updated.program.id, name: updated.program.name } : null,
    };
  }

  @Delete("stores/:id")
  async deleteStore(@Req() request: { user: AccessToken }, @Param("id") id: string) {
    assertHq(request.user);
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: { _count: { select: { devices: true } } },
    });
    if (!store) throw new NotFoundException("지점을 찾을 수 없어요");
    if (store._count.devices > 0) {
      throw new ConflictException({
        message: "연결된 TV가 있어 삭제할 수 없어요. 먼저 비활성화하세요.",
        deviceCount: store._count.devices,
      });
    }
    if (store.programId) {
      throw new ConflictException({
        message: "지정된 프로그램이 있어 삭제할 수 없어요. 먼저 프로그램 지정을 해제하세요.",
        programId: store.programId,
      });
    }
    await this.prisma.store.delete({ where: { id } });
    return { ok: true };
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
