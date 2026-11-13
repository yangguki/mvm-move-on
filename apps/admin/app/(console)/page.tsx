import type { Metadata } from "next";
import { DashboardScreen } from "./dashboard-screen";

export const metadata: Metadata = { title: "대시보드 · MOVE ON 관리자" };

export default function DashboardPage() {
  return <DashboardScreen />;
}
