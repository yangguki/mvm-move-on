/** HTML 스킨 화면에서 치환 가능한 토큰 (관리자·플레이어 공유) */
export const HTML_SKIN_TOKENS = [
  "label",
  "remainingSec",
  "totalSec",
  "next.label",
  "next.afterRest",
  "round",
  "roundTotal",
  "stepIndex",
  "stepTotal",
  "program.name",
  "logoUrl",
  "pointColor",
] as const;

export type HtmlSkinTokenName = (typeof HTML_SKIN_TOKENS)[number];

export type HtmlSkinTokenMap = Partial<Record<HtmlSkinTokenName | string, string | number | boolean>>;

export const HTML_SKIN_SAMPLE_TOKENS: HtmlSkinTokenMap = {
  label: "숄더 프레스",
  remainingSec: 32,
  totalSec: 45,
  "next.label": "휴식 후 · 런지",
  "next.afterRest": true,
  round: 2,
  roundTotal: 3,
  stepIndex: 4,
  stepTotal: 12,
  "program.name": "상체 데이",
  logoUrl: "/skins/neon-arcade/logo.png",
  pointColor: "#C8F31D",
};

export const HTML_SKIN_CONTENT_MAX_BYTES = 200 * 1024;