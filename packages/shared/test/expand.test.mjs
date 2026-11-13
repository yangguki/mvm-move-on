import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expand, playTotalSec } from "../src/program.ts";

describe("expand", () => {
  it("그룹 x3 예시: 총 150초, 9개 항목, NEXT 라벨", () => {
    const program = {
      id: "demo",
      name: "어깨 서킷",
      status: "draft",
      draftUpdatedAt: "2026-11-13T00:00:00.000Z",
      publishedVersion: null,
      skin: {
        id: "neon-arcade",
        options: { pointColor: "#C8F31D", nextLeadSec: 10 },
      },
      items: [
        {
          id: "g1",
          type: "group",
          repeat: 3,
          steps: [
            { id: "s1", type: "exercise", durationSec: 20, label: "덤벨 숄더 프레스" },
            { id: "s2", type: "exercise", durationSec: 20, label: "얼터네이트 숄더 프레스" },
            { id: "s3", type: "rest", durationSec: 10, label: "휴식" },
          ],
        },
      ],
    };

    const play = expand(program);

    assert.equal(play.length, 9);
    assert.equal(playTotalSec(play), 150);

    assert.equal(play[0].label, "덤벨 숄더 프레스");
    assert.equal(play[0].next?.label, "얼터네이트 숄더 프레스");
    assert.equal(play[0].next?.afterRest, false);

    assert.equal(play[1].label, "얼터네이트 숄더 프레스");
    assert.equal(play[1].next?.label, "휴식 후 · 덤벨 숄더 프레스");
    assert.equal(play[1].next?.afterRest, true);

    assert.equal(play[2].type, "rest");
    assert.equal(play[2].next?.label, "덤벨 숄더 프레스");
    assert.equal(play[2].next?.afterRest, false);

    assert.equal(play[7].next, undefined);
    assert.equal(play[8].next, undefined);
  });
});
