import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const rootEnv = resolve(process.cwd(), "../../.env");
const localEnv = resolve(__dirname, "../.env.development");

if (existsSync(rootEnv)) {
  config({ path: rootEnv });
} else if (process.env.NODE_ENV !== "production" && existsSync(localEnv)) {
  config({ path: localEnv });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.ADMIN_ORIGIN ?? "http://localhost:3000",
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
