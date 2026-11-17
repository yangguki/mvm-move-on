-- CreateEnum
CREATE TYPE "skin_kind" AS ENUM ('tokens', 'html');

-- AlterTable
ALTER TABLE "skins" ADD COLUMN "kind" "skin_kind" NOT NULL DEFAULT 'tokens';

-- CreateTable
CREATE TABLE "skin_screens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "skin_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL DEFAULT '',
    "css" TEXT NOT NULL DEFAULT '',
    "has_video_slot" BOOLEAN NOT NULL DEFAULT false,
    "has_next_video_slot" BOOLEAN NOT NULL DEFAULT false,
    "title_only" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "skin_screens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skin_screens_skin_id_sort_order_idx" ON "skin_screens"("skin_id", "sort_order");

-- AddForeignKey
ALTER TABLE "skin_screens" ADD CONSTRAINT "skin_screens_skin_id_fkey" FOREIGN KEY ("skin_id") REFERENCES "skins"("id") ON DELETE CASCADE ON UPDATE CASCADE;