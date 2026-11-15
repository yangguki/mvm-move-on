import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expand, playTotalSec } from "../src/program.ts";
import { resolveSkinAudio, withResolvedSkinAudio } from "../src/audio.ts";
import { validateProgram } from "../src/validate.ts";

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

  it("스냅샷 videos로 expand 시 url이 채워진다", () => {
    const video = {
      id: "v1",
      name: "덤벨 숄더 프레스",
      url: "/skins/neon-arcade/mvn_shoulder_press.mp4",
      durationSec: 3,
      thumbnailUrl: "/media/thumb-shoulder-press.jpg",
      width: 1920,
      height: 1080,
    };
    const program = {
      id: "demo",
      name: "영상 스냅샷",
      status: "published",
      draftUpdatedAt: "2026-11-13T00:00:00.000Z",
      publishedVersion: 1,
      skin: {
        id: "neon-arcade",
        options: { pointColor: "#C8F31D", nextLeadSec: 10 },
      },
      items: [{ id: "s1", type: "exercise", durationSec: 20, videoId: "v1" }],
      videos: { v1: video },
    };

    const play = expand(program, program.videos);

    assert.equal(play.length, 1);
    assert.equal(play[0].video?.url, "/skins/neon-arcade/mvn_shoulder_press.mp4");
    assert.equal(play[0].video?.name, "덤벨 숄더 프레스");
    assert.equal(play[0].label, "덤벨 숄더 프레스");
  });
});

describe("validateProgram", () => {
  it("그룹 안 그룹(중첩)을 금지한다", () => {
    const nested = {
      id: "nested-test",
      name: "중첩 테스트",
      status: "draft",
      skin: { id: "neon-arcade", options: { pointColor: "#C8F31D", nextLeadSec: 10 } },
      items: [
        {
          id: "g1",
          type: "group",
          repeat: 2,
          steps: [
            { id: "g2", type: "group", repeat: 2, steps: [{ id: "s1", type: "exercise", durationSec: 20 }] },
          ],
        },
      ],
    };
    assert.throws(() => validateProgram(nested), /그룹을 중첩할 수 없어요/);
  });
});

describe("snapshot audio", () => {
  it("게시 스냅샷에 music·voicePack url을 풀어 넣는다", () => {
    const music = {
      id: "m1",
      name: "BGM",
      url: "/media/audio/bgm.mp3",
      durationSec: 60,
      mimeType: "audio/mpeg",
    };
    const cue = (id, name) => ({
      id,
      name,
      url: `/media/audio/${id}.mp3`,
      durationSec: 1,
      mimeType: "audio/mpeg",
    });
    const voicePack = {
      id: "vp1",
      name: "기본",
      cues: {
        countdown5: cue("c5", "5"),
        countdown4: cue("c4", "4"),
        countdown3: cue("c3", "3"),
        countdown2: cue("c2", "2"),
        countdown1: cue("c1", "1"),
        restStart: cue("rs", "휴식 시작"),
      },
    };
    const lookup = {
      musicById: new Map([[music.id, music]]),
      defaultMusic: music,
      voicePackById: new Map([[voicePack.id, voicePack]]),
      defaultVoicePack: voicePack,
    };
    const skin = resolveSkinAudio(
      {
        id: "neon-arcade",
        options: { pointColor: "#C8F31D", nextLeadSec: 10, musicId: "m1", voicePackId: "vp1" },
      },
      lookup,
    );
    assert.equal(skin.music?.url, "/media/audio/bgm.mp3");
    assert.equal(skin.voicePack?.cues.countdown3.url, "/media/audio/c3.mp3");
    assert.equal(skin.voicePack?.cues.restStart.url, "/media/audio/rs.mp3");

    const program = withResolvedSkinAudio(
      {
        id: "p1",
        name: "테스트",
        status: "published",
        draftUpdatedAt: "2026-11-13T00:00:00.000Z",
        publishedVersion: 1,
        skin: {
          id: "neon-arcade",
          options: { pointColor: "#C8F31D", nextLeadSec: 10 },
        },
        items: [],
      },
      lookup,
    );
    assert.equal(program.skin.options.musicId, "m1");
    assert.equal(program.skin.options.voicePackId, "vp1");
    assert.ok(program.skin.music?.url);
    assert.ok(program.skin.voicePack?.cues.countdown1.url);
  });
});
