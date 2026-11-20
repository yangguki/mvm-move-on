import type { Metadata } from "next";
import { SkinsView } from "./skins-view";

export const metadata: Metadata = { title: "스킨 · MOVE ON 관리자" };

export default function SkinsPage() {
  return <SkinsView />;
}
