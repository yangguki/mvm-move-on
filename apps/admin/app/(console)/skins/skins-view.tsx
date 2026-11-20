"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Plus } from "lucide-react";
import { SkinCardThumbnail, type SkinPreviewScreen } from "./skin-card-thumbnail";

type SkinItem = {
  id: string;
  slug: string;
  name: string;
  tone: string;
  kind?: string;
  isActive: boolean;
  screenCount?: number;
  programCount?: number;
  usedInPrograms: string[];
  previewScreen: SkinPreviewScreen | null;
};

export function SkinsView() {
  const [skins, setSkins] = useState<SkinItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  void (async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ items: SkinItem[] }>("/admin/v1/skins");
      setSkins(
        data.items.map((skin) => ({
          ...skin,
          programCount: skin.programCount ?? skin.usedInPrograms?.length ?? 0,
        })),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "스킨을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  })();
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="t-title">스킨</h1>
          <p>TV 화면 테마 목록입니다. 카드를 누르면 상세로 이동해요.</p>
        </div>
        <div className="row">
          <Link href="/skins/new" className="btn btn-primary">
            <Plus className="i" aria-hidden />
            새 스킨
          </Link>
        </div>
      </div>
      {error ? <p className="form-error" style={{ marginTop: -8 }}>{error}</p> : null}
      {loading ? <p className="subtle">불러오는 중…</p> : null}
      {!loading && skins.length === 0 ? <p className="subtle">등록된 스킨이 없어요.</p> : null}
      <div className="tpl-grid">
        {skins.map((skin) => (
          <Link
            key={skin.id}
            href={`/skins/${skin.id}`}
            className="tpl"
            style={{
              textDecoration: "none",
              color: "inherit",
              opacity: skin.isActive ? 1 : 0.62,
            }}
          >
            <SkinCardThumbnail
              previewScreen={skin.kind === "html" ? skin.previewScreen : null}
              tone={skin.tone}
              name={skin.name}
            />
            <b>{skin.name}</b>
            <small>
              화면 {skin.screenCount ?? 0}개 · 프로그램 {skin.programCount ?? 0}개
              {skin.kind === "html" ? " · HTML" : ""}
              {!skin.isActive ? " · 비활성" : ""}
            </small>
          </Link>
        ))}
      </div>
    </>
  );
}