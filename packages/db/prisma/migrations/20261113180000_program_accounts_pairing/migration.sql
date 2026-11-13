ALTER TABLE "accounts" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "programs" ADD COLUMN "lock_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "programs" ADD COLUMN "draft_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "programs" ADD COLUMN "published_version" INTEGER;

ALTER TABLE "program_steps" ADD COLUMN "subtitle" TEXT;
ALTER TABLE "program_steps" ADD COLUMN "group_key" TEXT;
ALTER TABLE "program_steps" ADD COLUMN "group_label" TEXT;
ALTER TABLE "program_steps" ADD COLUMN "group_repeat" INTEGER;

ALTER TABLE "devices" ADD COLUMN "video_loop_mode" TEXT NOT NULL DEFAULT 'ab';

CREATE TABLE "program_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "skin_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "program_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "program_versions_program_id_version_key" ON "program_versions"("program_id", "version");
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_skin_id_fkey" FOREIGN KEY ("skin_id") REFERENCES "skins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "program_version_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subtitle" TEXT,
    "seconds" INTEGER NOT NULL,
    "group_key" TEXT,
    "group_label" TEXT,
    "group_repeat" INTEGER,
    CONSTRAINT "program_version_steps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "program_version_steps_version_id_position_key" ON "program_version_steps"("version_id", "position");
ALTER TABLE "program_version_steps" ADD CONSTRAINT "program_version_steps_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "program_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "account_stores" (
    "account_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    CONSTRAINT "account_stores_pkey" PRIMARY KEY ("account_id", "store_id")
);
ALTER TABLE "account_stores" ADD CONSTRAINT "account_stores_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_stores" ADD CONSTRAINT "account_stores_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pairing_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pairing_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pairing_sessions_code_key" ON "pairing_sessions"("code");
ALTER TABLE "pairing_sessions" ADD CONSTRAINT "pairing_sessions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
