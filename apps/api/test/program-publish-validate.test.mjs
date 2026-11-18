import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectMissingPublishVideos,
  missingPublishVideosMessage,
} from "../src/program-publish-validate.ts";

describe("collectMissingPublishVideos", () => {
  it("tokens: exercise without videoId is missing", () => {
    const missing = collectMissingPublishVideos(
      [
        { id: "g1", type: "guide", durationSec: 5, label: "카운트" },
        { id: "e1", type: "exercise", durationSec: 30, label: "스쿼트" },
        { id: "r1", type: "rest", durationSec: 10, label: "휴식" },
      ],
      { skinKind: "tokens" },
    );
    assert.deepEqual(missing, [{ stepNumber: 2, label: "스쿼트" }]);
    assert.match(missingPublishVideosMessage(missing) ?? "", /2단계 "스쿼트"/);
  });

  it("tokens: exercise with videoId passes", () => {
    assert.deepEqual(
      collectMissingPublishVideos(
        [{ id: "e1", type: "exercise", durationSec: 30, label: "스쿼트", videoId: "v1" }],
        { skinKind: "tokens" },
      ),
      [],
    );
  });

  it("html: hasVideoSlot screen without videoId is missing", () => {
    const screens = [
      { id: "title", hasVideoSlot: false },
      { id: "main", hasVideoSlot: true },
      { id: "next", hasVideoSlot: false },
    ];
    const missing = collectMissingPublishVideos(
      [
        { id: "s1", type: "guide", durationSec: 5, label: "타이틀", screenId: "title" },
        { id: "s2", type: "exercise", durationSec: 30, label: "메인", screenId: "main" },
        { id: "s3", type: "rest", durationSec: 10, label: "다음", screenId: "next" },
      ],
      { skinKind: "html", screens },
    );
    assert.deepEqual(missing, [{ stepNumber: 2, label: "메인" }]);
  });

  it("html: next-video-only screen does not require videoId", () => {
    const screens = [{ id: "next", hasVideoSlot: false }];
    assert.deepEqual(
      collectMissingPublishVideos(
        [{ id: "s1", type: "rest", durationSec: 10, label: "다음 예고", screenId: "next" }],
        { skinKind: "html", screens },
      ),
      [],
    );
  });

  it("html: both-slot screen still requires videoId when hasVideoSlot", () => {
    const screens = [{ id: "warmup", hasVideoSlot: true }];
    const missing = collectMissingPublishVideos(
      [{ id: "s1", type: "rest", durationSec: 20, label: "워밍업", screenId: "warmup" }],
      { skinKind: "html", screens },
    );
    assert.deepEqual(missing, [{ stepNumber: 1, label: "워밍업" }]);
  });

  it("walks group steps with flat numbering", () => {
    const missing = collectMissingPublishVideos(
      [
        {
          id: "grp",
          type: "group",
          repeat: 2,
          steps: [
            { id: "e1", type: "exercise", durationSec: 20, label: "A", videoId: "v1" },
            { id: "e2", type: "exercise", durationSec: 20, label: "B" },
          ],
        },
      ],
      { skinKind: "tokens" },
    );
    assert.deepEqual(missing, [{ stepNumber: 2, label: "B" }]);
  });
});
