import type { SkinKind } from "./program";

/** Cloudflare D1 row types (SQLite); JSON columns are stored as TEXT. */

export type CloudVideoStatus = "uploading" | "processing" | "ready" | "failed";
export type CloudVideoSourceType = "url" | "upload";

export type CloudProgramRow = {
  id: string;
  name: string;
  status: string;
  draft: string;
  draftUpdatedAt: string;
  publishedVersion: number | null;
  createdAt: string;
  updatedAt: string;
  rev: number;
};

export type CloudProgramVersionRow = {
  id: string;
  programId: string;
  version: number;
  publishedAt: string;
  snapshot: string;
};

export type CloudSkinRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tone: string;
  thumbnailUrl: string | null;
  kind: SkinKind;
  tokens: string;
  isActive: boolean;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
  rev: number;
};

export type CloudSkinScreenRow = {
  id: string;
  skinId: string;
  title: string;
  html: string;
  css: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
  defaultDurationSec: number | null;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CloudVideoRow = {
  id: string;
  name: string;
  url: string;
  durationSec: number;
  thumbnailUrl: string;
  width: number;
  height: number;
  status: CloudVideoStatus;
  sourceType: CloudVideoSourceType;
  error: string | null;
  sizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CloudStoreRow = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  programId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CloudDeviceRow = {
  id: string;
  storeId: string;
  skinId: string;
  name: string;
  code: string;
  status: string;
  statusLabel: string;
  playing: string | null;
  progress: number | null;
  appVersion: string;
  versionWarn: boolean;
  seenLabel: string;
  seenAlert: boolean;
  guide: boolean;
  offline: boolean;
  videoLoopMode: string;
  createdAt: string;
  updatedAt: string;
};

export type CloudPairingSessionRow = {
  id: string;
  storeId: string | null;
  code: string;
  expiresAt: string;
  consumedAt: string | null;
  approvedAt: string | null;
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CloudSeedData = {
  programs: CloudProgramRow[];
  program_versions: CloudProgramVersionRow[];
  skins: CloudSkinRow[];
  skin_screens: CloudSkinScreenRow[];
  videos: CloudVideoRow[];
  stores: CloudStoreRow[];
  devices: CloudDeviceRow[];
};