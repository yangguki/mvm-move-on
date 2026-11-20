import type { CloudEnv } from "../env";

export type DeviceTokenPayload = {
  storeId: string;
  deviceId: string;
  exp: number;
};

const DEFAULT_DEVICE_SECRET = "mvn-device-secret";
const DEVICE_TTL_SEC = 60 * 60 * 24 * 365;

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

function encodePayload(payload: DeviceTokenPayload): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function decodePayload(body: string): DeviceTokenPayload | null {
  try {
    const text = new TextDecoder().decode(base64UrlToBytes(body));
    return JSON.parse(text) as DeviceTokenPayload;
  } catch {
    return null;
  }
}

function deviceSecret(env: CloudEnv): string {
  return env.JWT_DEVICE_SECRET?.trim() || DEFAULT_DEVICE_SECRET;
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

export async function signDeviceToken(env: CloudEnv, storeId: string, deviceId: string): Promise<string> {
  const payload: DeviceTokenPayload = {
    storeId,
    deviceId,
    exp: Math.floor(Date.now() / 1000) + DEVICE_TTL_SEC,
  };
  const body = encodePayload(payload);
  const signature = await hmacSha256Base64Url(deviceSecret(env), body);
  return `${body}.${signature}`;
}

export async function verifyDeviceToken(env: CloudEnv, token: string): Promise<DeviceTokenPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await hmacSha256Base64Url(deviceSecret(env), body);
  const left = new TextEncoder().encode(signature);
  const right = new TextEncoder().encode(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const payload = decodePayload(body);
  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.storeId || !payload.deviceId) return null;
  return payload;
}

export function readDeviceTokenHeader(request: Request): string {
  return request.headers.get("x-device-token") ?? "";
}