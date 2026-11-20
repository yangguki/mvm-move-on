export const DUPLICATE_TITLE_SUFFIX = " (복사본)";

export class SkinScreenOpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkinScreenOpsError";
  }
}

export function duplicateScreenTitle(title: string): string {
  return `${title}${DUPLICATE_TITLE_SUFFIX}`;
}

export function parseForceFlag(force: unknown): boolean {
  if (force === "1" || force === 1 || force === true) return true;
  return false;
}

export type MoveDirection = "up" | "down";

export function parseMoveDirection(raw: unknown): MoveDirection {
  if (raw !== "up" && raw !== "down") {
    throw new SkinScreenOpsError("direction은 up 또는 down이어야 해요");
  }
  return raw;
}

/** 정렬된 id 목록에서 이웃과 맞바꿀 대상 인덱스. 끝이면 null (no-op). */
export function neighborSwapIndex(sortedIds: string[], screenId: string, direction: MoveDirection): number | null {
  const idx = sortedIds.indexOf(screenId);
  if (idx < 0) return null;
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= sortedIds.length) return null;
  return target;
}

export function compactSortOrderAssignments(rows: { id: string; sortOrder: number }[]): { id: string; sortOrder: number }[] {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  return sorted.map((row, sortOrder) => ({ id: row.id, sortOrder }));
}