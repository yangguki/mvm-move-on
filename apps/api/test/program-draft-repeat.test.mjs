import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateProgram, validateHtmlProgramSteps } from "../../../packages/shared/dist/index.js";

/** programs.controller asDraft: validateProgram → validateHtmlProgramSteps (html) */
function normalizeDraftItems(items, screens, skinKind) {
  const program = validateProgram({
    id: "draft",
    name: "tmp",
    status: "draft",
    draftUpdatedAt: new Date().toISOString(),
    publishedVersion: null,
    skin: { id: "neon-arcade", options: { pointColor: "#C8F31D", nextLeadSec: 10 }, kind: skinKind },
    items,
  });
  if (skinKind === "html") {
    validateHtmlProgramSteps(program.items, screens, "draft");
  }
  return program.items;
}

describe("draft repeatCount (asDraft 경로)", () => {
  it("exercise repeatCount가 validateProgram 후에도 남는다", () => {
    const items = normalizeDraftItems(
      [
        {
          id: "ex-1",
          type: "exercise",
          durationSec: 12,
          repeatCount: 3,
          videoId: "v1",
          screenId: "main",
        },
      ],
      [{ id: "main", hasVideoSlot: true, hasNextVideoSlot: false, titleOnly: false }],
      "html",
    );
    assert.equal(items[0].repeatCount, 3);
    assert.equal(items[0].durationSec, 12);
  });

  it("발행용 validateProgram도 repeatCount를 유지한다", () => {
    const program = validateProgram({
      id: "p1",
      name: "테스트",
      status: "published",
      draftUpdatedAt: new Date().toISOString(),
      publishedVersion: 1,
      skin: { id: "neon-arcade", options: { pointColor: "#C8F31D", nextLeadSec: 10 } },
      items: [
        {
          id: "ex-1",
          type: "exercise",
          durationSec: 12,
          repeatCount: 3,
          videoId: "v1",
        },
      ],
    });
    assert.equal(program.items[0].repeatCount, 3);
  });
});