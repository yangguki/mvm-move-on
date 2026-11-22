import assert from "node:assert/strict";
import test from "node:test";
import { FIXED_ADMIN } from "../src/auth/admin-user.ts";
import { newAccessPayload, signAccessToken } from "../src/auth/session.ts";
import { handleApprovePairing } from "../src/routes/pairing-admin.ts";
import { matchRoute } from "../src/router-match.ts";

const SECRET = "test-session-secret";
const STORE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SESSION_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

test("pairing-sessions admin route removed", () => {
  assert.equal(matchRoute("POST", "/api/admin/v1/pairing-sessions"), undefined);
});

test("approve-pairing route registered", () => {
  assert.equal(matchRoute("POST", "/api/admin/v1/approve-pairing")?.name, "approve-pairing");
});

function mockDb({ store = null, session = null, skin = { id: "skin-1" } } = {}) {
  const inserts = [];
  return {
    db: {
      prepare(sql) {
        let params = [];
        const stmt = {
          bind(...p) {
            params = p;
            return stmt;
          },
          async all() {
            if (/FROM stores WHERE id/.test(sql)) {
              if (store && params[0] === store.id) return { results: [store] };
              return { results: [] };
            }
            if (/FROM pairing_sessions WHERE code/.test(sql)) {
              if (session) return { results: [session] };
              return { results: [] };
            }
            if (/FROM skins WHERE is_builtin/.test(sql)) {
              return { results: skin ? [skin] : [] };
            }
            return { results: [] };
          },
          async run() {
            if (/INSERT INTO devices/.test(sql)) inserts.push({ sql, params });
            if (/UPDATE pairing_sessions/.test(sql)) inserts.push({ sql, params });
            return { meta: { changes: 1 } };
          },
        };
        return stmt;
      },
    },
    inserts,
  };
}

async function authedRequest(body) {
  const token = await signAccessToken(SECRET, newAccessPayload(FIXED_ADMIN));
  return new Request("http://local/api/admin/v1/approve-pairing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `mvn_admin_session=${encodeURIComponent(token)}`,
    },
    body: JSON.stringify(body),
  });
}

function envWith(db) {
  return { DB: db, SESSION_SECRET: SECRET };
}

test("approve pairing requires storeId", async () => {
  const { db } = mockDb();
  const res = await handleApprovePairing(await authedRequest({ code: "123456" }), envWith(db));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.message, /지점/);
});

test("approve pairing unknown store returns 404", async () => {
  const { db } = mockDb();
  const res = await handleApprovePairing(
    await authedRequest({ code: "123456", storeId: "missing" }),
    envWith(db),
  );
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.message, /찾을 수 없/);
});

test("approve pairing saves chosen store on device and session", async () => {
  const now = new Date(Date.now() + 60_000).toISOString();
  const session = { id: SESSION_ID, expires_at: now, approved_at: null };
  const store = { id: STORE_ID, name: "QA-TEST-지점B", is_active: 1 };
  const { db, inserts } = mockDb({ store, session });
  const res = await handleApprovePairing(
    await authedRequest({ code: "123456", storeId: STORE_ID }),
    envWith(db),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.store.name, "QA-TEST-지점B");

  const deviceInsert = inserts.find((row) => /INSERT INTO devices/.test(row.sql));
  assert.ok(deviceInsert);
  assert.equal(deviceInsert.params[1], STORE_ID);

  const sessionUpdate = inserts.find((row) => /UPDATE pairing_sessions/.test(row.sql));
  assert.ok(sessionUpdate);
  assert.equal(sessionUpdate.params[2], STORE_ID);
});