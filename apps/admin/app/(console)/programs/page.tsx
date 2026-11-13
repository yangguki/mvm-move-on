import type { Metadata } from "next";
import { BuilderScreen } from "./builder-screen";

export const metadata: Metadata = { title: "프로그램 빌더 · MOVE ON 관리자" };

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const params = await searchParams;
  return <BuilderScreen initialId={params.id} />;
}
