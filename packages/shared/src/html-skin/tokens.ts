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
  "set",
  "setTotal",
  "program.name",
  "logoUrl",
  "pointColor",
] as const;

export type HtmlSkinTokenName = (typeof HTML_SKIN_TOKENS)[number];

export type HtmlSkinTokenMap = Partial<Record<HtmlSkinTokenName | string, string | number | boolean>>;

export const HTML_SKIN_SAMPLE_TOKENS: HtmlSkinTokenMap = {
  label: "케틀벨 스윙",
  remainingSec: 38,
  totalSec: 45,
  "next.label": "고블릿 스쿼트",
  "next.afterRest": true,
  round: 1,
  roundTotal: 4,
  stepIndex: 12,
  stepTotal: 74,
  set: 2,
  setTotal: 3,
  "program.name": "POWER BELL",
  logoUrl: "/skins/neon-arcade/logo.png",
  pointColor: "#C8F31D",
};

export const HTML_SKIN_CONTENT_MAX_BYTES = 200 * 1024;