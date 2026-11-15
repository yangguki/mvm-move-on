import {
  VOICE_CUE_KEYS,
  REST_CUE_KEYS,
  type AudioLookup,
  type ProgramSkin,
  type ResolvedAudioRef,
  type ResolvedVoicePack,
  type VoiceCueKey,
  withResolvedSkinAudio,
} from "@mvn/shared";
import type { PrismaService } from "./prisma.service";

function asRef(row: {
  id: string;
  name: string;
  url: string;
  durationSec: number;
  mimeType: string;
}): ResolvedAudioRef {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    durationSec: row.durationSec,
    mimeType: row.mimeType,
  };
}

export async function loadAudioLookup(prisma: PrismaService): Promise<AudioLookup> {
  const assets = await prisma.audioAsset.findMany();
  const packs = await prisma.voicePack.findMany();
  const musicById = new Map<string, ResolvedAudioRef>();
  const assetById = new Map<string, ResolvedAudioRef>();
  for (const row of assets) {
    const ref = asRef(row);
    assetById.set(row.id, ref);
    if (row.kind === "music") musicById.set(row.id, ref);
  }
  const voicePackById = new Map<string, ResolvedVoicePack>();
  let defaultVoicePack: ResolvedVoicePack | undefined;
  for (const pack of packs) {
    const cuesRaw = pack.cues as Partial<Record<VoiceCueKey, string>>;
    const cues = {} as ResolvedVoicePack["cues"];
    let ok = true;
    for (const key of VOICE_CUE_KEYS) {
      const asset = assetById.get(cuesRaw[key] ?? "");
      if (!asset) {
        ok = false;
        break;
      }
      cues[key] = asset;
    }
    if (!ok) continue;
    for (const key of REST_CUE_KEYS) {
      const asset = assetById.get(cuesRaw[key] ?? "");
      if (asset) cues[key] = asset;
    }
    const resolved: ResolvedVoicePack = { id: pack.id, name: pack.name, cues };
    voicePackById.set(pack.id, resolved);
    if (pack.isDefault) defaultVoicePack = resolved;
  }
  const defaultMusic =
    [...musicById.values()][0] ??
    assets.filter((a) => a.kind === "music").map(asRef)[0];
  if (!defaultVoicePack) defaultVoicePack = [...voicePackById.values()][0];
  return { musicById, defaultMusic, voicePackById, defaultVoicePack };
}

export async function resolveProgramSkin(prisma: PrismaService, skin: ProgramSkin) {
  const lookup = await loadAudioLookup(prisma);
  return withResolvedSkinAudio({ id: "tmp", name: "", status: "draft", draftUpdatedAt: "", publishedVersion: null, skin, items: [] }, lookup)
    .skin;
}
