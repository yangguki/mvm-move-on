import type { AccessTokenPayload } from "./admin-user";

const COOKIE_NAME = "mvn_admin_session";
const TOKEN_TTL_SEC = 60 * 60 * 24 * 7;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function base64UrlToBytes(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function hmacSha256Base64Url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

function encodePayload(payload: AccessTokenPayload): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function decodePayload(body: string): AccessTokenPayload | null {
  try {
    const text = new TextDecoder().decode(base64UrlToBytes(body));
    return JSON.parse(text) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function sessionTtlSec(): number {
  return TOKEN_TTL_SEC;
}

export function newAccessPayload(account: { id: string; email: string; role: string; tokenVersion: number }): AccessTokenPayload {
  return {
    sub: account.id,
    email: account.email,
    role: account.role,
    tv: account.tokenVersion,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
  };
}

export async function signAccessToken(secret: string, payload: AccessTokenPayload): Promise<string> {
  const body = encodePayload(payload);
  const signature = await hmacSha256Base64Url(secret, body);
  return `${body}.${signature}`;
}

export async function verifyAccessToken(secret: string, token: string): Promise<AccessTokenPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await hmacSha256Base64Url(secret, body);
  const left = new TextEncoder().encode(signature);
  const right = new TextEncoder().encode(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const payload = decodePayload(body);
  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.tv !== "number") return null;
  return payload;
}

export function sessionCookieHeader(token: string, request: Request, maxAgeSec = TOKEN_TTL_SEC): string {
  const secure = request.url.startsWith("https://") ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure}`;
}

export function clearSessionCookieHeader(request: Request): string {
  const secure = request.url.startsWith("https://") ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${COOKIE_NAME}=`)) continue;
    return decodeURIComponent(trimmed.slice(COOKIE_NAME.length + 1));
  }
  return null;
}

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function resolveAuth(
  request: Request,
  secret: string,
): Promise<AccessTokenPayload | null> {
  const bearer = readBearerToken(request);
  if (bearer) {
    const payload = await verifyAccessToken(secret, bearer);
    if (payload) return payload;
  }
  const cookie = readSessionCookie(request);
  if (cookie) return verifyAccessToken(secret, cookie);
  return null;
}

/** For unit tests: parse route patterns exported from router */
export const SESSION_COOKIE_NAME = COOKIE_NAME;