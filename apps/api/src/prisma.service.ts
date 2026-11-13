import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@mvn/db";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
