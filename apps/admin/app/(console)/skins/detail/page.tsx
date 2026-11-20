import type { Metadata } from "next";
import { Suspense } from "react";
import { SkinDetailView } from "./skin-detail-view";

export const metadata: Metadata = { title: "스킨 상세 · MOVE ON 관리자" };

export default function SkinDetailPage() {
  return (
    <Suspense fallback={<p className="subtle">불러오는 중…</p>}>
      <SkinDetailView />
    </Suspense>
  );
}