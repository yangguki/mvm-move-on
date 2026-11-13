import { config } from "dotenv";
import { resolve } from "path";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

config({ path: resolve(process.cwd(), "../../.env") });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.ADMIN_ORIGIN ?? "http://localhost:3000",
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
