-- CreateEnum
CREATE TYPE "video_status" AS ENUM ('uploading', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "video_source_type" AS ENUM ('url', 'upload');

-- AlterTable
ALTER TABLE "videos" ADD COLUMN "status" "video_status" NOT NULL DEFAULT 'ready';
ALTER TABLE "videos" ADD COLUMN "source_type" "video_source_type" NOT NULL DEFAULT 'url';
ALTER TABLE "videos" ADD COLUMN "error" TEXT;
ALTER TABLE "videos" ADD COLUMN "size_bytes" INTEGER;
ALTER TABLE "videos" ADD COLUMN "storage_key" TEXT;
