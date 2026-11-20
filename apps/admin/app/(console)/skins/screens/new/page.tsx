import type { Metadata } from "next";
import { Suspense } from "react";
import { SkinScreenNewView } from "./skin-screen-new-view";

export const metadata: Metadata = { title: "화면 추가 · MOVE ON 관리자" };

export default function NewSkinScreenPage() {
  return (
    <Suspense fallback={<p className="subtle">불러오는 중…</p>}>
      <SkinScreenNewView />
    </Suspense>
  );
}