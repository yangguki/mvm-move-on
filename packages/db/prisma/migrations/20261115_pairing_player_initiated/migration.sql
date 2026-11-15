-- Make storeId nullable for player-initiated pairing
ALTER TABLE "pairing_sessions" ALTER COLUMN "store_id" DROP NOT NULL;

-- Add approvedAt and deviceId for new pairing flow
ALTER TABLE "pairing_sessions" ADD COLUMN "approved_at" TIMESTAMPTZ(3);
ALTER TABLE "pairing_sessions" ADD COLUMN "device_id" UUID;
