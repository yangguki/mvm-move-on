import type { Metadata } from "next";
import Link from "next/link";
import { SkinDetailBody } from "./skin-detail-body";

export const metadata: Metadata = { title: "스킨 상세 · MOVE ON 관리자" };

type Props = { params: Promise<{ id: string }> };

export default async function SkinDetailPage({ params }: Props) {
  const { id } = await params;
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