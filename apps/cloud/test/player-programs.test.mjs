import assert from "node:assert/strict";
import test from "node:test";
import { signDeviceToken } from "../src/auth/device-token.ts";
import { handlePlayerProgramsList, requirePlayerDevice, storeAssignedPublishedProgramId } from "../src/routes/player-device.ts";
import { matchRoute } from "../src/router-match.ts";

const DEVICE_SECRET = "test-device-secret";
const STORE_ID = "store-aaa";
const DEVICE_ID = "device-bbb";
const OTHER_PROGRAM = "prog-other";
const ASSIGNED_PROGRAM = "prog-assigned";
const UNPUBLISHED_ASSIGNED = "prog-draft";

const programs = {
  [ASSIGNED_PROGRAM]: { id: ASSIGNED_PROGRAM, name: "배정 프로그램", published_version: 2, updated_at: "2026-01-01T00:00:00Z" },
  [OTHER_PROGRAM]: { id: OTHER_PROGRAM, name: "다른 프로그램", published_version: 1, updated_at: "2026-01-02T00:00:00Z" },
  [UNPUBLISHED_ASSIGNED]: { id: UNPUBLISHED_ASSIGNED, name: "미발행", published_version: null, updated_at: "2026-01-01T00:00:00Z" },
};

const stores = {
  [STORE_ID]: { program_id: null },
  "store-with-prog": { program_id: ASSIGNED_PROGRAM },
  "store-draft-prog": { program_id: UNPUBLISHED_ASSIGNED },
};

const devices = {
  [DEVICE_ID]: { store_id: STORE_ID, last_seen_at: null },
  "device-with-prog": { store_id: "store-with-prog", last_seen_at: null },
  "device-draft-prog": { store_id: "store-draft-prog", last_seen_at: null },
};

const versions = {
  [`${ASSIGNED_PROGRAM}:2`]: { published_at: "2026-01-01T12:00:00Z", snapshot: '{"id":"x","name":"배정","items":[],"skin":{"id":"neon-arcade","options":{}}}' },
};

function mockDb({ deviceRows = devices, storeRows = stores, programRows = programs, versionRows = versions } = {}) {
  return {
    prepare(sql) {
      let params = [];
      const stmt = {
        bind(...p) {
          params = p;
          return stmt;
        },
        async all() {
          if (/FROM devices WHERE id/.test(sql)) {
            const row = deviceRows[params[0]];
            if (row && !("last_seen_at" in row)) return { results: [{ ...row, last_seen_at: null }] };
            return { results: row ? [row] : [] };
          }
          if (/FROM stores WHERE id/.test(sql)) {
            const row = storeRows[params[0]];
            return { results: row ? [row] : [] };
          }
          if (/FROM programs WHERE id = \? AND published_version/.test(sql)) {
            const row = programRows[params[0]];
            if (row?.published_version != null) return { results: [row] };
            return { results: [] };
          }
          if (/FROM programs WHERE id = \?\s*$/.test(sql) || /SELECT id, name, published_version, updated_at FROM programs WHERE id = \?/.test(sql)) {
            const row = programRows[params[0]];
            return { results: row ? [row] : [] };
          }
          if (/SELECT published_version FROM programs WHERE id/.test(sql)) {
            const row = programRows[params[0]];
            return { results: row ? [{ published_version: row.published_version }] : [] };
          }
          if (/FROM program_versions WHERE program_id/.test(sql) && /published_at/.test(sql) && !/snapshot/.test(sql)) {
            const key = `${params[0]}:${params[1]}`;
            const row = versionRows[key];
            return { results: row ? [{ published_at: row.published_at }] : [] };
          }
          if (/SELECT version, published_at, snapshot FROM program_versions/.test(sql)) {
            const key = `${params[0]}:${params[1]}`;
            const row = versionRows[key];
            return { results: row ? [{ version: params[1], published_at: row.published_at, snapshot: row.snapshot }] : [] };
          }
          return { results: [] };
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };
}

async function authedRequest(path) {
  const token = await signDeviceToken({ JWT_DEVICE_SECRET: DEVICE_SECRET }, STORE_ID, DEVICE_ID);
  return new Request(`http://local/api/player/v1${path}`, {
    headers: { "X-Device-Token": token },
  });
}

function envWith(db) {
  return { DB: db, JWT_DEVICE_SECRET: DEVICE_SECRET };
}

test("player programs list is empty when store has no assignment", async () => {
  const db = mockDb();
  const res = await handlePlayerProgramsList(await authedRequest("/programs"), envWith(db));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.items, []);
});

test("player programs list shows only store-assigned published program", async () => {
  const token = await signDeviceToken({ JWT_DEVICE_SECRET: DEVICE_SECRET }, "store-with-prog", "device-with-prog");
  const req = new Request("http://local/api/player/v1/programs", { headers: { "X-Device-Token": token } });
  const db = mockDb();
  const res = await handlePlayerProgramsList(req, envWith(db));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].id, ASSIGNED_PROGRAM);
  assert.ok(!body.items.some((p) => p.id === OTHER_PROGRAM));
});

test("player programs list empty when assigned program is unpublished", async () => {
  const token = await signDeviceToken({ JWT_DEVICE_SECRET: DEVICE_SECRET }, "store-draft-prog", "device-draft-prog");
  const req = new Request("http://local/api/player/v1/programs", { headers: { "X-Device-Token": token } });
  const db = mockDb();
  const res = await handlePlayerProgramsList(req, envWith(db));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.items, []);
});

test("player programs list returns 401 when device row missing", async () => {
  const token = await signDeviceToken({ JWT_DEVICE_SECRET: DEVICE_SECRET }, STORE_ID, "deleted-device");
  const req = new Request("http://local/api/player/v1/programs", { headers: { "X-Device-Token": token } });
  const db = mockDb();
  const res = await handlePlayerProgramsList(req, envWith(db));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.message, "기기 인증이 필요해요");
});

test("storeAssignedPublishedProgramId ignores unpublished assignment", async () => {
  const db = mockDb();
  const id = await storeAssignedPublishedProgramId(envWith(db), "store-draft-prog");
  assert.equal(id, null);
});

test("player program detail route uses player auth", () => {
  assert.equal(matchRoute("GET", "/api/player/v1/programs/prog-1")?.name, "player-program-detail");
  assert.equal(matchRoute("GET", "/api/player/v1/programs/prog-1")?.auth, "player");
});

test("player authenticated routes return 401 when device row missing (programs detail path)", async () => {
  const token = await signDeviceToken({ JWT_DEVICE_SECRET: DEVICE_SECRET }, STORE_ID, "deleted-detail");
  const req = new Request("http://local/api/player/v1/programs/prog-1", { headers: { "X-Device-Token": token } });
  const db = mockDb();
  const auth = await requirePlayerDevice(req, envWith(db));
  assert.ok(auth instanceof Response);
  assert.equal(auth.status, 401);
});

test("requirePlayerDevice uses device row store_id not token store", async () => {
  const token = await signDeviceToken({ JWT_DEVICE_SECRET: DEVICE_SECRET }, "token-store-wrong", "device-with-prog");
  const req = new Request("http://local/", { headers: { "X-Device-Token": token } });
  const db = mockDb();
  const auth = await requirePlayerDevice(req, envWith(db));
  assert.ok(!(auth instanceof Response));
  assert.equal(auth.storeId, "store-with-prog");
});