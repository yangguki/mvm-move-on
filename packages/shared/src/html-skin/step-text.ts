/** 스텝 text 필드에서 set/round 메타 파싱 (예: set=2/3) */
export type HtmlSkinStepTextMeta = {
  set: number;
  setTotal: number;
  round: number;
  roundTotal: number;
};

const SET_RE = /\bset\s*=\s*(\d+)\s*\/\s*(\d+)/i;
const ROUND_RE = /\bround\s*=\s*(\d+)\s*\/\s*(\d+)/i;

export function parseHtmlSkinStepText(text: string | undefined): HtmlSkinStepTextMeta {
  const fallback = { set: 1, setTotal: 1, round: 1, roundTotal: 1 };
  if (!text?.trim()) return fallback;
  const setM = text.match(SET_RE);
  const roundM = text.match(ROUND_RE);
  return {
    set: setM ? Number(setM[1]) : fallback.set,
    setTotal: setM ? Number(setM[2]) : fallback.setTotal,
    round: roundM ? Number(roundM[1]) : fallback.round,
    roundTotal: roundM ? Number(roundM[2]) : fallback.roundTotal,
  };
}