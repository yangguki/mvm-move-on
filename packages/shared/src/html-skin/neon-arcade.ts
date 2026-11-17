export type NeonArcadeLoadedScreen = {
  title: string;
  html: string;
  css: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
  sortOrder: number;
};

/** 스크린샷 파일명: neon-html-<title>.png */
export function neonArcadeScreenshotFilename(title: string): string {
  return `neon-html-${title}.png`;
}