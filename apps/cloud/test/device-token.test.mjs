import assert from "node:assert/strict";
import test from "node:test";
import { signDeviceToken, verifyDeviceToken } from "../src/auth/device-token.ts";

const env = { JWT_DEVICE_SECRET: "test-device-secret" };

test("sign and verify device token", async () => {
  const token = await signDeviceToken(env, "store-1", "device-1");
  const payload = await verifyDeviceToken(env, token);
  assert.ok(payload);
  assert.equal(payload.storeId, "store-1");
  assert.equal(payload.deviceId, "device-1");
});

test("reject bad device token", async () => {
  assert.equal(await verifyDeviceToken(env, "bad.token"), null);
});