export type MvnDataMode = "api" | "cloud";

export function getDataMode(): MvnDataMode {
  const raw = process.env.NEXT_PUBLIC_MVN_DATA_MODE;
  return raw === "cloud" ? "cloud" : "api";
}

export function isCloudDataMode(): boolean {
  return getDataMode() === "cloud";
}

/** Admin API prefix (always same-origin `/api` in both modes). */
export function apiBaseUrl(): string {
  return "/api";
}

const CLOUD_HIDDEN_NAV = new Set(["/audio", "/accounts"]);

export function isNavHiddenInCloud(href: string): boolean {
  return isCloudDataMode() && CLOUD_HIDDEN_NAV.has(href);
}