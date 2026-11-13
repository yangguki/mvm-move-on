import { Shell } from "@/components/shell";
import "./screens.css";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
