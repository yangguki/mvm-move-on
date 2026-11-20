export const FIXED_ADMIN = {
  id: "hq-admin-local",
  email: "inkuk.yang@mvmfit.kr",
  displayName: "양인국",
  role: "hq_admin" as const,
  tokenVersion: 0,
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: string;
  tv: number;
  exp: number;
};