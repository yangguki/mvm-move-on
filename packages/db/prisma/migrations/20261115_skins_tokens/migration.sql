-- AlterTable: Skin 모델 확장
ALTER TABLE "skins" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "skins" ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT;
ALTER TABLE "skins" ADD COLUMN IF NOT EXISTS "tokens" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "skins" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "skins" ADD COLUMN IF NOT EXISTS "is_builtin" BOOLEAN NOT NULL DEFAULT false;

-- Drop old is_system column if it exists
ALTER TABLE "skins" DROP COLUMN IF EXISTS "is_system";
