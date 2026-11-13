-- Drop old step tables / FKs
DROP TABLE IF EXISTS "program_version_steps";
DROP TABLE IF EXISTS "program_steps";

-- Recreate program_versions without skin/name/steps
ALTER TABLE "program_versions" DROP CONSTRAINT IF EXISTS "program_versions_skin_id_fkey";
ALTER TABLE "program_versions" DROP CONSTRAINT IF EXISTS "program_versions_program_id_fkey";
DROP TABLE IF EXISTS "program_versions";

ALTER TABLE "programs" DROP CONSTRAINT IF EXISTS "programs_skin_id_fkey";
DROP TABLE IF EXISTS "programs";

CREATE TABLE "videos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "duration_sec" INTEGER NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "programs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "draft_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_version" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "program_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    CONSTRAINT "program_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "program_versions_program_id_version_key" ON "program_versions"("program_id", "version");

ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
