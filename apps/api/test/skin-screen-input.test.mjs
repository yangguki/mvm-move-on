import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DURATION_SEC_MAX,
  DEFAULT_DURATION_SEC_MIN,
  inferSlotType,
  parseDefaultDurationSecForCreate,
  parseDefaultDurationSecForUpdate,
  parseSlotType,
  resolveSlotFlagsForCreate,
  resolveSlotFlagsForUpdate,
  SkinScreenInputError,
  slotFlagsFromType,
} from "../../../packages/shared/dist/index.js";

describe("parseDefaultDurationSecForCreate", () => {
  it("accepts null and undefined as null", () => {
    assert.equal(parseDefaultDurationSecForCreate(null), null);
    assert.equal(parseDefaultDurationSecForCreate(undefined), null);
  });

  it("accepts 1 and max", () => {
    assert.equal(parseDefaultDurationSecForCreate(1), 1);
    assert.equal(parseDefaultDurationSecForCreate(DEFAULT_DURATION_SEC_MAX), DEFAULT_DURATION_SEC_MAX);
  });

  it("rejects out of range and non-integers", () => {
    assert.throws(() => parseDefaultDurationSecForCreate(0), SkinScreenInputError);
    assert.throws(() => parseDefaultDurationSecForCreate(DEFAULT_DURATION_SEC_MAX + 1), SkinScreenInputError);
    assert.throws(() => parseDefaultDurationSecForCreate(1.5), SkinScreenInputError);
    assert.throws(() => parseDefaultDurationSecForCreate("30"), SkinScreenInputError);
  });
});

describe("parseDefaultDurationSecForUpdate", () => {
  it("leaves field unchanged when omitted", () => {
    assert.equal(parseDefaultDurationSecForUpdate(undefined), undefined);
  });

  it("clears when null", () => {
    assert.equal(parseDefaultDurationSecForUpdate(null), null);
  });
});

describe("slotType and flags", () => {
  it("maps slotType to exactly one boolean", () => {
    assert.deepEqual(slotFlagsFromType("video"), {
      hasVideoSlot: true,
      hasNextVideoSlot: false,
      titleOnly: false,
    });
    assert.deepEqual(slotFlagsFromType("nextVideo"), {
      hasVideoSlot: false,
      hasNextVideoSlot: true,
      titleOnly: false,
    });
    assert.deepEqual(slotFlagsFromType("titleOnly"), {
      hasVideoSlot: false,
      hasNextVideoSlot: false,
      titleOnly: true,
    });
  });

  it("infers slotType from stored flags", () => {
    assert.equal(inferSlotType({ hasVideoSlot: true, hasNextVideoSlot: false, titleOnly: false }), "video");
    assert.equal(inferSlotType({ hasVideoSlot: false, hasNextVideoSlot: false, titleOnly: false }), null);
  });

  it("parseSlotType rejects invalid values", () => {
    assert.throws(() => parseSlotType("invalid"), SkinScreenInputError);
  });

  it("create prefers slotType over booleans", () => {
    const flags = resolveSlotFlagsForCreate({
      slotType: "titleOnly",
      hasVideoSlot: true,
    });
    assert.equal(flags.titleOnly, true);
    assert.equal(flags.hasVideoSlot, false);
  });

  it("update slotType sets all three flags", () => {
    const resolved = resolveSlotFlagsForUpdate({ slotType: "nextVideo" });
    assert.equal(resolved.mode, "slotType");
    assert.deepEqual(resolved.flags, slotFlagsFromType("nextVideo"));
  });

  it("update booleans only patches provided fields", () => {
    const resolved = resolveSlotFlagsForUpdate({ hasVideoSlot: true });
    assert.equal(resolved.mode, "booleans");
    assert.deepEqual(resolved.patch, { hasVideoSlot: true });
  });
});