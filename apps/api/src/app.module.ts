import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { AccountsController } from "./accounts.controller";
import { AuthController, MeController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { CatalogController } from "./catalog.controller";
import { DeviceAuthGuard } from "./device-auth.guard";
import { DeviceTokenService } from "./device-token.service";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { OperationsController } from "./operations.controller";
import { PrismaService } from "./prisma.service";
import { PlayerController } from "./player.controller";
import { ProgramsController } from "./programs.controller";
import { StorageService } from "./storage.service";
import { TokenService } from "./token.service";
import { VideosController } from "./videos.controller";
import { VideoQueueService } from "./video-queue.service";
import { AudioController } from "./audio.controller";
import { VoicePacksController } from "./voice-packs.controller";

@Module({
  imports: [
    MulterModule.register({
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  ],
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
  providers: [
    HealthService,
    PrismaService,
    TokenService,
    AuthGuard,
    DeviceTokenService,
    DeviceAuthGuard,
    StorageService,
    VideoQueueService,
  ],
})
export class AppModule {}
