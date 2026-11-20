import assert from "node:assert/strict";
import test from "node:test";
import { FIXED_ADMIN } from "../src/auth/admin-user.ts";
import {
  newAccessPayload,
  sessionTtlSec,
  signAccessToken,
  verifyAccessToken,
} from "../src/auth/session.ts";

const SECRET = "test-session-secret";

test("sessionTtlSec is seven days", () => {
  assert.equal(sessionTtlSec(), 60 * 60 * 24 * 7);
});

test("sign and verify access token", async () => {
  const payload = newAccessPayload(FIXED_ADMIN);
  const token = await signAccessToken(SECRET, payload);
  const verified = await verifyAccessToken(SECRET, token);
  assert.ok(verified);
  assert.equal(verified.sub, FIXED_ADMIN.id);
  assert.equal(verified.email, FIXED_ADMIN.email);
});

test("reject tampered token", async () => {
  const payload = newAccessPayload(FIXED_ADMIN);
  const token = await signAccessToken(SECRET, payload);
  const bad = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  assert.equal(await verifyAccessToken(SECRET, bad), null);
});