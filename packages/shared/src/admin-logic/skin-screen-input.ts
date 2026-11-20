export type SkinScreenSlotType = "video" | "nextVideo" | "titleOnly";

export type SkinScreenSlotFlags = {
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
};

export class SkinScreenInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkinScreenInputError";
  }
}

const SLOT_TYPES: SkinScreenSlotType[] = ["video", "nextVideo", "titleOnly"];

export const DEFAULT_DURATION_SEC_MIN = 1;
export const DEFAULT_DURATION_SEC_MAX = 3600;

export function inferSlotType(flags: SkinScreenSlotFlags): SkinScreenSlotType | null {
  if (flags.titleOnly) return "titleOnly";
  if (flags.hasVideoSlot) return "video";
  if (flags.hasNextVideoSlot) return "nextVideo";
  return null;
}

export function slotFlagsFromType(type: SkinScreenSlotType): SkinScreenSlotFlags {
  return {
    hasVideoSlot: type === "video",
    hasNextVideoSlot: type === "nextVideo",
    titleOnly: type === "titleOnly",
  };
}

export function parseSlotType(value: unknown): SkinScreenSlotType {
  if (typeof value !== "string" || !SLOT_TYPES.includes(value as SkinScreenSlotType)) {
    throw new SkinScreenInputError("슬롯 유형은 video, nextVideo, titleOnly 중 하나여야 해요");
  }
  return value as SkinScreenSlotType;
}

/** 생성 시: 미지정이면 null, 1..3600 정수만 허용 */
export function parseDefaultDurationSecForCreate(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  return parseDefaultDurationSecValue(value);
}

/** 수정 시: 필드 없으면 undefined(변경 없음), null이면 해제 */
export function parseDefaultDurationSecForUpdate(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parseDefaultDurationSecValue(value);
}

function parseDefaultDurationSecValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new SkinScreenInputError(
      `기본 재생 시간은 ${DEFAULT_DURATION_SEC_MIN}~${DEFAULT_DURATION_SEC_MAX}초 정수이거나 null이어야 해요`,
    );
  }
  if (value < DEFAULT_DURATION_SEC_MIN || value > DEFAULT_DURATION_SEC_MAX) {
    throw new SkinScreenInputError(
      `기본 재생 시간은 ${DEFAULT_DURATION_SEC_MIN}~${DEFAULT_DURATION_SEC_MAX}초 사이여야 해요`,
    );
  }
  return value;
}

export function resolveSlotFlagsForCreate(raw: Record<string, unknown>): SkinScreenSlotFlags {
  if (raw.slotType !== undefined) {
    return slotFlagsFromType(parseSlotType(raw.slotType));
  }
  return {
    hasVideoSlot: raw.hasVideoSlot === true,
    hasNextVideoSlot: raw.hasNextVideoSlot === true,
    titleOnly: raw.titleOnly === true,
  };
}

export type SkinScreenSlotFlagsUpdate =
  | { mode: "slotType"; flags: SkinScreenSlotFlags }
  | { mode: "booleans"; patch: Partial<SkinScreenSlotFlags> };

export function resolveSlotFlagsForUpdate(
  raw: Record<string, unknown>,
): SkinScreenSlotFlagsUpdate | undefined {
  if (raw.slotType !== undefined) {
    return { mode: "slotType", flags: slotFlagsFromType(parseSlotType(raw.slotType)) };
  }
  const patch: Partial<SkinScreenSlotFlags> = {};
  if (typeof raw.hasVideoSlot === "boolean") patch.hasVideoSlot = raw.hasVideoSlot;
  if (typeof raw.hasNextVideoSlot === "boolean") patch.hasNextVideoSlot = raw.hasNextVideoSlot;
  if (typeof raw.titleOnly === "boolean") patch.titleOnly = raw.titleOnly;
  if (!Object.keys(patch).length) return undefined;
  return { mode: "booleans", patch };
}