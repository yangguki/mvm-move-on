-- Add isActive and programId columns to stores table
ALTER TABLE "stores" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "stores" ADD COLUMN "program_id" UUID;

-- Add foreign key constraint for program_id
ALTER TABLE "stores" ADD CONSTRAINT "stores_program_id_fkey" 
  FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
