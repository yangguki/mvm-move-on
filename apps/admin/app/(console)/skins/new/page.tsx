import type { Metadata } from "next";
import Link from "next/link";
import { NewSkinForm } from "./new-skin-form";

export const metadata: Metadata = { title: "새 스킨 · MOVE ON 관리자" };

export default function NewSkinPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="t-title">새 스킨</h1>
          <p className="subtle">이름만 입력하면 HTML 스킨이 만들어져요. 화면은 상세에서 이어서 등록합니다.</p>
        </div>
        <Link href="/skins" className="btn btn-secondary">
          목록으로
        </Link>
      </div>
      <NewSkinForm />
    </>
  );
}