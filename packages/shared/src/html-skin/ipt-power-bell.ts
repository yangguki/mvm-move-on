export type IptPowerBellLoadedScreen = {
  slug: string;
  title: string;
  html: string;
  css: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
  sortOrder: number;
};

/** 스크린샷 파일명: <slug>.png */
export function iptPowerBellScreenshotFilename(slug: string): string {
  return `${slug}.png`;
}
