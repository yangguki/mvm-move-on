import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { writeFile } from "fs/promises";
import { extname } from "path";
import { PrismaService } from "./prisma.service";
import { StorageService } from "./storage.service";
import {
  probe,
  buildFfmpegArgs,
  transcode,
  generateThumbnail,
  tempPath,
  cleanupFile,
  readFileBuffer,
  checkFfmpeg,
} from "./video-process";

type Job = {
  videoId: string;
  inputPath: string;
  originalName: string;
};

@Injectable()
export class VideoQueueService implements OnModuleDestroy {
  private queue: Job[] = [];
  private processing = 0;
  private maxConcurrent = 2;
  private ffmpegAvailable: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  onModuleDestroy() {
    this.queue = [];
  }

  async enqueue(videoId: string, fileBuffer: Buffer, originalName: string): Promise<void> {
    const ext = extname(originalName).toLowerCase() || ".mp4";
    const inputPath = tempPath(ext);
    await writeFile(inputPath, fileBuffer);

    this.queue.push({ videoId, inputPath, originalName });
    void this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.processing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.processing++;
    try {
      await this.processVideo(job);
    } catch (err) {
      console.error(`Video processing failed for ${job.videoId}:`, err);
    } finally {
      this.processing--;
      void this.processNext();
    }
  }

  private async processVideo(job: Job): Promise<void> {
    const { videoId, inputPath, originalName } = job;
    const ext = extname(originalName).toLowerCase();
    const isGif = ext === ".gif";

    const outputPath = tempPath(".mp4");
    const thumbPath = tempPath(".jpg");

    try {
      if (this.ffmpegAvailable === null) {
        this.ffmpegAvailable = await checkFfmpeg();
      }

      if (!this.ffmpegAvailable) {
        await this.prisma.video.update({
          where: { id: videoId },
          data: {
            status: "failed",
            error: "ffmpeg가 설치되어 있지 않습니다. brew install ffmpeg로 설치해 주세요.",
          },
        });
        return;
      }

      const probeResult = await probe(inputPath);

      await this.prisma.video.update({
        where: { id: videoId },
        data: { status: "processing" },
      });

      const ffmpegArgs = buildFfmpegArgs(inputPath, outputPath, probeResult, isGif);
      await transcode(ffmpegArgs);

      const thumbAtSec = Math.min(1, probeResult.durationSec / 2);
      await generateThumbnail(outputPath, thumbPath, thumbAtSec);

      const videoBuffer = await readFileBuffer(outputPath);
      const thumbBuffer = await readFileBuffer(thumbPath);

      const timestamp = Date.now();
      const videoKey = `videos/${videoId}/${timestamp}.mp4`;
      const thumbKey = `videos/${videoId}/${timestamp}_thumb.jpg`;

      const videoUrl = await this.storage.upload(videoKey, videoBuffer, "video/mp4");
      const thumbUrl = await this.storage.upload(thumbKey, thumbBuffer, "image/jpeg");

      const finalProbe = await probe(outputPath);

      await this.prisma.video.update({
        where: { id: videoId },
        data: {
          status: "ready",
          url: videoUrl,
          thumbnailUrl: thumbUrl,
          durationSec: finalProbe.durationSec,
          width: finalProbe.width,
          height: finalProbe.height,
          sizeBytes: videoBuffer.length,
          storageKey: videoKey,
          error: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      await this.prisma.video.update({
        where: { id: videoId },
        data: {
          status: "failed",
          error: message.slice(0, 500),
        },
      });
    } finally {
      await cleanupFile(inputPath);
      await cleanupFile(outputPath);
      await cleanupFile(thumbPath);
    }
  }
}
