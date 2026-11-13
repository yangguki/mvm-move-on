import type { Metadata } from "next";
import { SkinsView } from "./skins-view";

export const metadata: Metadata = { title: "스킨 · MOVE ON 관리자" };

// TODO: 스킨 API 연결 전 시안 값. 네온 아케이드만 실제 화면이고 나머지 4종은 임시 미니 목업이에요.
export default function SkinsPage() {
  return <SkinsView />;
}
