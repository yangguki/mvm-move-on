import type { Program, ProgramSkin, ResolvedAudioRef, ResolvedVoicePack, VoiceCueKey } from "./program";

export const VOICE_CUE_KEYS: VoiceCueKey[] = [
  "countdown5",
  "countdown4",
  "countdown3",
  "countdown2",
  "countdown1",
  "restStart",
];

export type AudioLookup = {
  musicById: Map<string, ResolvedAudioRef>;
  defaultMusic?: ResolvedAudioRef;
  voicePackById: Map<string, ResolvedVoicePack>;
  defaultVoicePack?: ResolvedVoicePack;
};

/** 게시 스냅샷용: musicId/voicePackId를 url까지 풀어 skin에 붙입니다. */
export function resolveSkinAudio(skin: ProgramSkin, lookup: AudioLookup): ProgramSkin {
  const musicId = skin.options.musicId;
  const voicePackId = skin.options.voicePackId;
  const music =
    (musicId ? lookup.musicById.get(musicId) : undefined) ?? lookup.defaultMusic;
  const voicePack =
    (voicePackId ? lookup.voicePackById.get(voicePackId) : undefined) ?? lookup.defaultVoicePack;
  return {
    ...skin,
    options: {
      ...skin.options,
      musicId: music?.id ?? skin.options.musicId,
      voicePackId: voicePack?.id ?? skin.options.voicePackId,
    },
    music,
    voicePack,
  };
}

export function withResolvedSkinAudio(program: Program, lookup: AudioLookup): Program {
  return {
    ...program,
    skin: resolveSkinAudio(program.skin, lookup),
  };
}
