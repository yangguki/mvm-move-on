export type MvnDataMode = "api" | "cloud";

export function getDataMode(): MvnDataMode {
  const raw = import.meta.env.VITE_MVN_DATA_MODE;
  return raw === "cloud" ? "cloud" : "api";
}

export function isCloudDataMode(): boolean {
  return getDataMode() === "cloud";
}

/** Player API prefix: `/api/player/v1/...` in cloud, `/player/v1/...` in local api mode. */
export function playerApiPrefix(): string {
  return isCloudDataMode() ? "/api/player/v1" : "/player/v1";
}

/** Published-program poll interval while playing (cloud: 60s). */
export const PROGRAM_PUBLISH_CHECK_MS = isCloudDataMode() ? 60_000 : 0;