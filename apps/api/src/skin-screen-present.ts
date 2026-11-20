import { inferSlotType } from "./skin-screen-input";

export function presentSkinScreen(row: {
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
  updatedAt: Date;
}) {
  return {
    id: row.id,
    skinId: row.skinId,
    title: row.title,
    html: row.html,
    css: row.css,
    hasVideoSlot: row.hasVideoSlot,
    hasNextVideoSlot: row.hasNextVideoSlot,
    titleOnly: row.titleOnly,
    slotType: inferSlotType(row),
    defaultDurationSec: row.defaultDurationSec,
    sortOrder: row.sortOrder,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}