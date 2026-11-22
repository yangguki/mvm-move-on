import assert from "node:assert/strict";
import test from "node:test";
import { handleDeviceUpdate, handleDeviceDelete } from "../src/routes/device-mutations.ts";

const DEVICE_ID = "dev-qa-1";
const STORE_OK = "store-active";
const STORE_OFF = "store-off";
const STORE_MISSING = "store-missing";

const stores = {
  [STORE_OK]: { id: STORE_OK, is_active: 1 },
  [STORE_OFF]: { id: STORE_OFF, is_active: 0 },
};

function mockDb({ devices = { [DEVICE_ID]: { id: DEVICE_ID, code: "TV-QA01" } }, storeRows = stores } = {}) {
  return {
    prepare(sql) {
      let params = [];
      const stmt = {
        bind(...p) {
          params = p;
          return stmt;
        },
        async all() {
          if (/FROM devices WHERE id/.test(sql) && /SELECT id, code/.test(sql)) {
            const row = devices[params[0]];
            return { results: row ? [{ id: row.id, code: row.code }] : [] };
          }
          if (/FROM devices WHERE id/.test(sql) && /SELECT id FROM/.test(sql)) {
            const row = devices[params[0]];
            return { results: row ? [{ id: row.id }] : [] };
          }
          if (/FROM devices d/.test(sql) && /WHERE d.id/.test(sql)) {
            const row = devices[params[0]];
            if (!row) return { results: [] };
            return {
              results: [
                {
                  id: row.id,
                  name: row.name ?? "TV",
                  code: row.code ?? "TV-X",
                  video_loop_mode: "single",
                  store_id: row.store_id ?? STORE_OK,
                  store_name: "지점",
                  store_code: "ST",
                  skin_id: "sk1",
                  skin_name: "스킨",
                },
              ],
            };
          }
          if (/FROM stores WHERE id/.test(sql)) {
            const row = storeRows[params[0]];
            return { results: row ? [row] : [] };
          }
          return { results: [] };
        },
        async run() {
          if (/UPDATE devices SET/.test(sql) && params.length >= 5) {
            const id = params[4];
            if (devices[id]) {
              if (params[0] != null) devices[id].name = params[0];
              if (params[2] != null) devices[id].store_id = params[2];
            }
          }
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };
}

const env = { DB: null };

test("PATCH device storeId ok", async () => {
  const db = mockDb();
  env.DB = db;
  const req = new Request("http://local/", {
    method: "PATCH",
    body: JSON.stringify({ storeId: STORE_OK }),
  });
  const res = await handleDeviceUpdate(req, env, DEVICE_ID);
  assert.equal(res.status, 200);
});

test("PATCH device unknown storeId 404", async () => {
  const db = mockDb();
  env.DB = db;
  const req = new Request("http://local/", {
    method: "PATCH",
    body: JSON.stringify({ storeId: STORE_MISSING }),
  });
  const res = await handleDeviceUpdate(req, env, DEVICE_ID);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.message, "지점을 찾을 수 없어요");
});

test("PATCH device inactive storeId 400", async () => {
  const db = mockDb();
  env.DB = db;
  const req = new Request("http://local/", {
    method: "PATCH",
    body: JSON.stringify({ storeId: STORE_OFF }),
  });
  const res = await handleDeviceUpdate(req, env, DEVICE_ID);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.message, "비활성 지점이에요");
});

test("PATCH device empty name 400", async () => {
  const db = mockDb();
  env.DB = db;
  const req = new Request("http://local/", {
    method: "PATCH",
    body: JSON.stringify({ name: "   " }),
  });
  const res = await handleDeviceUpdate(req, env, DEVICE_ID);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.message, "TV 이름을 입력해 주세요");
});

test("DELETE seed device TV-O8I0 returns 409", async () => {
  const db = mockDb({ devices: { seed: { id: "seed", code: "TV-O8I0" } } });
  env.DB = db;
  const res = await handleDeviceDelete(new Request("http://local/"), env, "seed");
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.message, "시드 기기는 삭제할 수 없어요");
});