import type { Metadata } from "next";
import { StoresScreen } from "./stores-screen";

export const metadata: Metadata = { title: "지점 · MOVE ON 관리자" };

export default function StoresPage() {
  return <StoresScreen />;
}
