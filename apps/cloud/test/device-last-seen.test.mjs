import assert from "node:assert/strict";
import test from "node:test";
import { signDeviceToken } from "../src/auth/device-token.ts";
import { requirePlayerDevice, touchDeviceLastSeenIfStale } from "../src/routes/player-device.ts";

const DEVICE_SECRET = "test-device-secret";
const STORE_ID = "store-aaa";
const DEVICE_ID = "device-bbb";

function mockDb({ lastSeenAt = null, updates = [] } = {}) {
  const device = { store_id: STORE_ID, last_seen_at: lastSeenAt };
  return {
    prepare(sql) {
      let params = [];
      const stmt = {
        bind(...p) {
          params = p;
          return stmt;
        },
        async all() {
          if (/FROM devices WHERE id/.test(sql) && /last_seen_at/.test(sql)) {
            return device ? { results: [device] } : { results: [] };
          }
          return { results: [] };
        },
        async run() {
          if (/UPDATE devices SET last_seen_at/.test(sql)) {
            updates.push({ at: params[0], deviceId: params[2] });
            device.last_seen_at = params[0];
          }
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    },
    updates,
  };
}

async function authedRequest() {
  const token = await signDeviceToken({ JWT_DEVICE_SECRET: DEVICE_SECRET }, STORE_ID, DEVICE_ID);
  return new Request("http://local/api/player/v1/programs", {
    headers: { "X-Device-Token": token },
  });
}

function envWith(db) {
  return { DB: db, JWT_DEVICE_SECRET: DEVICE_SECRET };
}

test("touchDeviceLastSeenIfStale skips write when seen within 30s", async () => {
  const recent = new Date("2026-03-20T12:00:00Z").toISOString();
  const db = mockDb({ lastSeenAt: recent });
  const updates = db.updates;
  await touchDeviceLastSeenIfStale(envWith(db), DEVICE_ID, recent, new Date("2026-03-20T12:00:15Z"));
  assert.equal(updates.length, 0);
});

test("touchDeviceLastSeenIfStale writes when last seen is stale", async () => {
  const stale = new Date("2026-03-20T11:00:00Z").toISOString();
  const now = new Date("2026-03-20T12:00:00Z");
  const db = mockDb({ lastSeenAt: stale });
  await touchDeviceLastSeenIfStale(envWith(db), DEVICE_ID, stale, now);
  assert.equal(db.updates.length, 1);
  assert.equal(db.updates[0].at, now.toISOString());
});

test("requirePlayerDevice updates last_seen on auth", async () => {
  const db = mockDb({ lastSeenAt: null });
  const auth = await requirePlayerDevice(await authedRequest(), envWith(db));
  assert.ok(!(auth instanceof Response));
  assert.equal(db.updates.length, 1);
  assert.equal(db.updates[0].deviceId, DEVICE_ID);
});