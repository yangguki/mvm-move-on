import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { expand, type Program as SharedProgram } from "@mvn/shared";
import { PrismaService } from "./prisma.service";

@Controller("player/v1/programs")
export class PlayerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(":id")
  async latest(@Param("id") id: string) {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program || program.publishedVersion == null) {
      throw new NotFoundException("발행된 프로그램을 찾을 수 없어요");
    }
    const version = await this.prisma.programVersion.findUnique({
      where: { programId_version: { programId: id, version: program.publishedVersion } },
    });
    if (!version) throw new NotFoundException("발행 스냅샷을 찾을 수 없어요");
    const snapshot = version.snapshot as SharedProgram;
    return {
      ...snapshot,
      playItems: expand(snapshot),
      publishedVersion: version.version,
      publishedAt: version.publishedAt.toISOString(),
    };
  }
}
