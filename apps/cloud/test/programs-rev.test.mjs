import assert from "node:assert/strict";
import test from "node:test";
import { nestConflict } from "../src/http.ts";

test("program save conflict matches admin builder 409 copy", async () => {
  const res = nestConflict({ message: "다른 곳에서 변경됨, 새로고침 필요" });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.statusCode, 409);
  assert.equal(body.message, "다른 곳에서 변경됨, 새로고침 필요");
});

test("programs-save route is registered", async () => {
  const { matchRoute } = await import("../src/router-match.ts");
  assert.equal(matchRoute("PUT", "/api/admin/v1/programs/p1")?.name, "programs-save");
});