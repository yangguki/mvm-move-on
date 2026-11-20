import { collectScreenIds } from "../html-skin/screens";
import type { ProgramItem, ProgramSkin } from "../program";

export type ProgramScreenUsageRow = {
  name: string;
  draft: unknown;
  publishedSnapshot: unknown | null;
};

export type ProgramSnapshotLike = {
  items?: ProgramItem[];
  skin?: ProgramSkin;
};

export function snapshotUsesScreen(snapshot: ProgramSnapshotLike | null | undefined, screenId: string): boolean {
  if (!snapshot) return false;
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  if (collectScreenIds(items).includes(screenId)) return true;
  const screens = snapshot.skin?.screens;
  if (screens && typeof screens === "object" && Object.prototype.hasOwnProperty.call(screens, screenId)) {
    return true;
  }
  return false;
}

export function programNamesUsingScreen(rows: ProgramScreenUsageRow[], screenId: string): string[] {
  const names: string[] = [];
  for (const row of rows) {
    const draft = row.draft as ProgramSnapshotLike;
    const published = row.publishedSnapshot as ProgramSnapshotLike | null;
    if (snapshotUsesScreen(draft, screenId) || snapshotUsesScreen(published, screenId)) {
      if (!names.includes(row.name)) names.push(row.name);
    }
  }
  return names;
}

export function screenDeleteBlockedMessage(programs: string[]): string | null {
  if (programs.length === 0) return null;
  return "이 화면을 사용하는 프로그램이 있어요. force=1 로 강제 삭제할 수 있어요";
}