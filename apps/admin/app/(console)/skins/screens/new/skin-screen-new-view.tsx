"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { skinDetailPath } from "@/lib/admin-paths";
import { SkinScreenEditor } from "../skin-screen-editor";

export function SkinScreenNewView() {
  const searchParams = useSearchParams();
  const skinId = searchParams.get("skinId")?.trim() ?? "";

  if (!skinId) {
    return <p className="form-error">skinId가 필요해요.</p>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="t-title">화면 추가</h1>
          <p className="subtle">HTML·CSS를 편집하고 미리보기로 확인할 수 있어요.</p>
        </div>
        <Link href={skinDetailPath(skinId)} className="btn btn-secondary">
          스킨 상세로
        </Link>
      </div>
      <SkinScreenEditor skinId={skinId} />
    </>
  );
}