import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { programDeleteBlockedMessage } from "../../../packages/shared/dist/index.js";

describe("programDeleteBlockedMessage", () => {
  it("allows delete when no store is assigned", () => {
    assert.equal(programDeleteBlockedMessage(0), null);
  });

  it("blocks delete when a store/TV is assigned", () => {
    const message = programDeleteBlockedMessage(1);
    assert.ok(message);
    assert.match(message, /지점/);
    assert.match(message, /삭제할 수 없어요/);
  });

  it("blocks delete for multiple assigned stores", () => {
    assert.ok(programDeleteBlockedMessage(3));
  });
});
