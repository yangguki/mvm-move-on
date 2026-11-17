import type { Group, HtmlSkinScreensMap, Program, ProgramItem, ResolvedVoicePack, SkinKind, Step, Video } from "./program";
import { VOICE_CUE_KEYS } from "./audio";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field}가 필요해요`);
  return value.trim();
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field}는 숫자여야 해요`);
  return value;
}

function validateStep(raw: unknown, path: string): Step {
  if (!isRecord(raw)) throw new Error(`${path} 스텝 형식이 아니에요`);
  const type = asString(raw.type, `${path}.type`);
  if (type !== "exercise" && type !== "rest" && type !== "guide") {
    throw new Error(`${path}.type은 exercise|rest|guide 중 하나예요`);
  }
  const durationSec = asNumber(raw.durationSec, `${path}.durationSec`);
  if (!Number.isInteger(durationSec) || durationSec <= 0) throw new Error(`${path}.durationSec는 1 이상 정수예요`);
  const step: Step = {
    id: asString(raw.id, `${path}.id`),
    type,
    durationSec,
  };
  if (raw.videoId != null) step.videoId = asString(raw.videoId, `${path}.videoId`);
  if (raw.screenId != null) step.screenId = asString(raw.screenId, `${path}.screenId`);
  if (raw.label != null) step.label = asString(raw.label, `${path}.label`);
  if (raw.text != null) step.text = asString(raw.text, `${path}.text`);
  return step;
}

function validateGroup(raw: unknown, path: string): Group {
  if (!isRecord(raw)) throw new Error(`${path} 그룹 형식이 아니에요`);
  const repeat = asNumber(raw.repeat, `${path}.repeat`);
  if (!Number.isInteger(repeat) || repeat < 2) throw new Error(`${path}.repeat는 2 이상이에요`);
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) throw new Error(`${path}.steps가 비어 있어요`);
  for (let i = 0; i < raw.steps.length; i++) {
    const step = raw.steps[i];
    if (isRecord(step) && step.type === "group") {
      throw new Error(`${path}.steps[${i}]에 그룹을 중첩할 수 없어요`);
    }
  }
  return {
    id: asString(raw.id, `${path}.id`),
    type: "group",
    repeat,
    steps: raw.steps.map((step, index) => validateStep(step, `${path}.steps[${index}]`)),
  };
}

function validateItem(raw: unknown, path: string): ProgramItem {
  if (!isRecord(raw)) throw new Error(`${path} 항목 형식이 아니에요`);
  if (raw.type === "group") return validateGroup(raw, path);
  return validateStep(raw, path);
}

/** draft/snapshot Program 형태를 검사하고 정규화합니다. */
export function validateProgram(raw: unknown): Program {
  if (!isRecord(raw)) throw new Error("프로그램 본문이 필요해요");
  if (!isRecord(raw.skin)) throw new Error("skin이 필요해요");
  const skinId = asString(raw.skin.id ?? "neon-arcade", "skin.id");
  if (!isRecord(raw.skin.options)) throw new Error("skin.options가 필요해요");
  const nextLeadSec = raw.skin.options.nextLeadSec == null ? 10 : asNumber(raw.skin.options.nextLeadSec, "skin.options.nextLeadSec");
  if (!Number.isInteger(nextLeadSec) || nextLeadSec < 0) throw new Error("nextLeadSec는 0 이상 정수예요");
  if (!Array.isArray(raw.items)) throw new Error("items 배열이 필요해요");
  const status = asString(raw.status ?? "draft", "status");
  if (status !== "draft" && status !== "published") throw new Error("status는 draft|published예요");
  const options: Program["skin"]["options"] = {
    pointColor: asString(raw.skin.options.pointColor ?? "#C8F31D", "skin.options.pointColor"),
    nextLeadSec,
  };
  if (raw.skin.options.logoUrl != null) options.logoUrl = asString(raw.skin.options.logoUrl, "skin.options.logoUrl");
  if (raw.skin.options.restImageUrl != null) options.restImageUrl = asString(raw.skin.options.restImageUrl, "skin.options.restImageUrl");
  if (raw.skin.options.musicId != null) options.musicId = asString(raw.skin.options.musicId, "skin.options.musicId");
  if (raw.skin.options.voicePackId != null) options.voicePackId = asString(raw.skin.options.voicePackId, "skin.options.voicePackId");
  const skin: Program["skin"] = { id: skinId, options };
  if (raw.skin.kind === "html" || raw.skin.kind === "tokens") skin.kind = raw.skin.kind as SkinKind;
  if (isRecord(raw.skin.tokens)) skin.tokens = raw.skin.tokens as Record<string, unknown>;
  if (isRecord(raw.skin.screens)) skin.screens = raw.skin.screens as HtmlSkinScreensMap;
  if (isRecord(raw.skin.music) && typeof raw.skin.music.url === "string") {
    skin.music = {
      id: asString(raw.skin.music.id, "skin.music.id"),
      name: asString(raw.skin.music.name, "skin.music.name"),
      url: asString(raw.skin.music.url, "skin.music.url"),
      durationSec: asNumber(raw.skin.music.durationSec, "skin.music.durationSec"),
      mimeType: typeof raw.skin.music.mimeType === "string" ? raw.skin.music.mimeType : undefined,
    };
  }
  if (isRecord(raw.skin.voicePack) && isRecord(raw.skin.voicePack.cues)) {
    const cues = raw.skin.voicePack.cues;
    const resolved: ResolvedVoicePack = {
      id: asString(raw.skin.voicePack.id, "skin.voicePack.id"),
      name: asString(raw.skin.voicePack.name, "skin.voicePack.name"),
      cues: {} as ResolvedVoicePack["cues"],
    };
    for (const key of VOICE_CUE_KEYS) {
      const cue = cues[key];
      if (!isRecord(cue)) throw new Error(`skin.voicePack.cues.${key}가 필요해요`);
      resolved.cues[key] = {
        id: asString(cue.id, `skin.voicePack.cues.${key}.id`),
        name: asString(cue.name ?? key, `skin.voicePack.cues.${key}.name`),
        url: asString(cue.url, `skin.voicePack.cues.${key}.url`),
        durationSec: asNumber(cue.durationSec ?? 1, `skin.voicePack.cues.${key}.durationSec`),
      };
    }
    skin.voicePack = resolved;
  }
  return {
    id: asString(raw.id ?? "draft", "id"),
    name: asString(raw.name, "name"),
    status,
    draftUpdatedAt: typeof raw.draftUpdatedAt === "string" ? raw.draftUpdatedAt : new Date().toISOString(),
    publishedVersion: raw.publishedVersion == null ? null : asNumber(raw.publishedVersion, "publishedVersion"),
    skin,
    items: raw.items.map((item, index) => validateItem(item, `items[${index}]`)),
  };
}

export function validateVideoInput(raw: unknown): Omit<Video, "id"> & { id?: string } {
  if (!isRecord(raw)) throw new Error("영상 본문이 필요해요");
  const width = asNumber(raw.width ?? 1920, "width");
  const height = asNumber(raw.height ?? 1080, "height");
  const durationSec = asNumber(raw.durationSec, "durationSec");
  if (!Number.isInteger(durationSec) || durationSec <= 0) throw new Error("durationSec는 1 이상 정수예요");
  const out: Omit<Video, "id"> & { id?: string } = {
    name: asString(raw.name, "name"),
    url: asString(raw.url, "url"),
    durationSec,
    thumbnailUrl: asString(raw.thumbnailUrl ?? raw.url, "thumbnailUrl"),
    width,
    height,
  };
  if (raw.id != null) out.id = asString(raw.id, "id");
  return out;
}
