import { Module } from "@nestjs/common";
import { AccountsController } from "./accounts.controller";
import { AuthController, MeController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { CatalogController } from "./catalog.controller";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { OperationsController } from "./operations.controller";
import { PrismaService } from "./prisma.service";
import { PlayerController } from "./player.controller";
import { ProgramsController } from "./programs.controller";
import { TokenService } from "./token.service";
import { VideosController } from "./videos.controller";
import { AudioController } from "./audio.controller";
import { VoicePacksController } from "./voice-packs.controller";

@Module({
  controllers: [
    HealthController,
    AuthController,
    MeController,
    CatalogController,
    ProgramsController,
    VideosController,
    AudioController,
    VoicePacksController,
    PlayerController,
    AccountsController,
    OperationsController,
  ],
  providers: [HealthService, PrismaService, TokenService, AuthGuard],
})
export class AppModule {}
