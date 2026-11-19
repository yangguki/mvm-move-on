import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { storeProgramAssignBlockedMessage } from "../src/store-program-assign.ts";

describe("storeProgramAssignBlockedMessage", () => {
  it("blocks when the program was never published", () => {
    const message = storeProgramAssignBlockedMessage(null);
    assert.ok(message);
    assert.match(message, /게시된 버전/);
  });

  it("allows assign when a published version exists", () => {
    assert.equal(storeProgramAssignBlockedMessage(1), null);
    assert.equal(storeProgramAssignBlockedMessage(3), null);
  });
});