import type { Metadata } from "next";
import { AccountsScreen } from "./accounts-screen";

export const metadata: Metadata = { title: "계정 · 권한 · MOVE ON 관리자" };

export default function AccountsPage() {
  return <AccountsScreen />;
}
