import type { Metadata } from "next";
import Link from "next/link";
import { SkinScreenEditor } from "../skin-screen-editor";

export const metadata: Metadata = { title: "화면 편집 · MOVE ON 관리자" };

type Props = { params: Promise<{ id: string; screenId: string }> };

export default async function EditSkinScreenPage({ params }: Props) {
  const { id, screenId } = await params;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="t-title">화면 편집</h1>
          <p className="subtle">HTML·CSS를 편집하고 미리보기로 확인할 수 있어요.</p>
        </div>
        <Link href={`/skins/${id}`} className="btn btn-secondary">
          스킨 상세로
        </Link>
      </div>
      <SkinScreenEditor skinId={id} screenId={screenId} />
    </>
  );
}