import type { Metadata } from "next";
import { DevicesScreen } from "./devices-screen";

export const metadata: Metadata = { title: "TV · 기기 · MOVE ON 관리자" };

export default function DevicesPage() {
  return <DevicesScreen />;
}
