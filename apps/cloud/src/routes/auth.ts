import { FIXED_ADMIN } from "../auth/admin-user";
import {
  clearSessionCookieHeader,
  newAccessPayload,
  readSessionCookie,
  resolveAuth,
  sessionCookieHeader,
  signAccessToken,
  verifyAccessToken,
} from "../auth/session";
import type { CloudEnv } from "../env";
import { json, nestError, noContent } from "../http";

type LoginBody = { email?: string; password?: string };

async function passwordsEqual(expected: string, actual: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("mvn-pw-check"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const [expSig, actSig] = await Promise.all([
    crypto.subtle.sign("HMAC", key, new TextEncoder().encode(expected)),
    crypto.subtle.sign("HMAC", key, new TextEncoder().encode(actual)),
  ]);
  const a = new Uint8Array(expSig);
  const b = new Uint8Array(actSig);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0 && expected.length === actual.length;
}

export async function handleLogin(request: Request, env: CloudEnv): Promise<Response> {
  let body: LoginBody = {};
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    body = {};
  }
  const password = body.password ?? "";
  if (!(await passwordsEqual(env.ADMIN_PASSWORD, password))) {
    return nestError("이메일 또는 비밀번호가 올바르지 않아요", 401);
  }
  const payload = newAccessPayload(FIXED_ADMIN);
  const accessToken = await signAccessToken(env.SESSION_SECRET, payload);
  return json(
    {
      accessToken,
      account: {
        id: FIXED_ADMIN.id,
        email: FIXED_ADMIN.email,
        displayName: FIXED_ADMIN.displayName,
        role: FIXED_ADMIN.role,
      },
    },
    200,
    { "set-cookie": sessionCookieHeader(accessToken, request) },
  );
}

export async function handleLogout(request: Request, env: CloudEnv): Promise<Response> {
  const token =
    (await resolveAuth(request, env.SESSION_SECRET)) ??
    (readSessionCookie(request)
      ? await verifyAccessToken(env.SESSION_SECRET, readSessionCookie(request)!)
      : null);
  if (!token) return nestError("로그인이 필요해요", 401);
  return noContent({ "set-cookie": clearSessionCookieHeader(request) });
}

export async function handleMe(request: Request, env: CloudEnv): Promise<Response> {
  const token = await resolveAuth(request, env.SESSION_SECRET);
  if (!token || token.sub !== FIXED_ADMIN.id || token.tv !== FIXED_ADMIN.tokenVersion) {
    return nestError("로그인이 필요해요", 401);
  }
  return json({
    id: FIXED_ADMIN.id,
    email: FIXED_ADMIN.email,
    displayName: FIXED_ADMIN.displayName,
    role: FIXED_ADMIN.role,
  });
}