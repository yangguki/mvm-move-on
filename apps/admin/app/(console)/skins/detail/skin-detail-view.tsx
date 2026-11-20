"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SkinDetailBody } from "./skin-detail-body";

export function SkinDetailView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim() ?? "";

  if (!id) {
    return <p className="form-error">스킨 id가 필요해요. 목록에서 스킨을 선택해 주세요.</p>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="t-title">스킨 상세</h1>
          <p className="subtle">이름을 수정하고 화면 목록을 확인할 수 있어요.</p>
        </div>
        <Link href="/skins" className="btn btn-secondary">
          목록으로
        </Link>
      </div>
      <SkinDetailBody id={id} />
    </>
  );
}