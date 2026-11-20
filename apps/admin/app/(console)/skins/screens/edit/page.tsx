import type { Metadata } from "next";
import { Suspense } from "react";
import { SkinScreenEditView } from "./skin-screen-edit-view";

export const metadata: Metadata = { title: "화면 편집 · MOVE ON 관리자" };

export default function EditSkinScreenPage() {
  return (
    <Suspense fallback={<p className="subtle">불러오는 중…</p>}>
      <SkinScreenEditView />
    </Suspense>
  );
}