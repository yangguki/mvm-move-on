import type { Metadata } from "next";
import localFont from "next/font/local";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  variable: "--font-pretendard",
});

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
  variable: "--font-archivo",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "MOVE ON 관리자",
  description: "운동 루틴 플레이어 관리자",
  icons: { icon: "/brand/a-v-forward-favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${archivo.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
