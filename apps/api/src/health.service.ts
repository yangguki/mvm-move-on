import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@mvn/db";
import Redis from "ioredis";

type ServiceState = "up" | "down";

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly prisma = new PrismaClient();
  private readonly redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    enableOfflineQueue: false,
  });
  private readonly s3 = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:4566",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "test",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "test",
    },
  });

  async onModuleDestroy() {
    await Promise.allSettled([this.prisma.$disconnect(), this.redis.quit()]);
  }

  async check() {
    const [postgres, redis, storage] = await Promise.all([
      this.pingPostgres(),
      this.pingRedis(),
      this.pingStorage(),
    ]);
    const services = { postgres, redis, storage };
    return {
      ok: Object.values(services).every((state) => state === "up"),
      services,
    };
  }

  private async pingPostgres(): Promise<ServiceState> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "up";
    } catch {
      return "down";
    }
  }

  private async pingRedis(): Promise<ServiceState> {
    try {
      if (this.redis.status !== "ready") {
        await this.redis.connect();
      }
      const reply = await this.redis.ping();
      return reply === "PONG" ? "up" : "down";
    } catch {
      return "down";
    }
  }

  private async pingStorage(): Promise<ServiceState> {
    const buckets = [
      process.env.S3_BUCKET_ORIGINAL ?? "mvn-original",
      process.env.S3_BUCKET_MEDIA ?? "mvn-media",
    ];
    try {
      for (const Bucket of buckets) {
        try {
          await this.s3.send(new HeadBucketCommand({ Bucket }));
        } catch {
          await this.s3.send(new CreateBucketCommand({ Bucket }));
        }
      }
      return "up";
    } catch {
      return "down";
    }
  }
}
