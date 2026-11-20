import assert from "node:assert/strict";
import test from "node:test";
import { randomDeviceCode, randomPairingCode } from "../src/pairing-code.ts";

test("pairing code is six digits", () => {
  const code = randomPairingCode();
  assert.match(code, /^\d{6}$/);
});

test("device code prefix", () => {
  const code = randomDeviceCode();
  assert.match(code, /^TV-[A-Z0-9]{4}$/);
});