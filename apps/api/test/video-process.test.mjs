import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFfmpegArgs, buildThumbnailArgs } from "../src/video-process.ts";

describe("buildFfmpegArgs", () => {
  it("GIF 입력: -an, scale, fps=30, H.264 High, faststart", () => {
    const probe = { durationSec: 5, width: 800, height: 600 };
    const result = buildFfmpegArgs("/tmp/input.gif", "/tmp/output.mp4", probe, true);

    assert.ok(result.args.includes("-an"), "오디오 제거 옵션");
    assert.ok(result.args.includes("-c:v"), "비디오 코덱 지정");
    assert.ok(result.args.includes("libx264"), "H.264 코덱");
    assert.ok(result.args.includes("-profile:v"), "프로파일 지정");
    assert.ok(result.args.includes("high"), "High 프로파일");
    assert.ok(result.args.includes("-movflags"), "movflags 지정");
    assert.ok(result.args.includes("+faststart"), "faststart");
    assert.ok(result.args.includes("-pix_fmt"), "픽셀 포맷 지정");
    assert.ok(result.args.includes("yuv420p"), "yuv420p");

    const vfIndex = result.args.indexOf("-vf");
    assert.ok(vfIndex >= 0, "-vf 옵션 존재");
    assert.ok(result.args[vfIndex + 1].includes("fps=30"), "fps=30 필터");
  });

  it("세로 영상(1080x1920): 긴 변 1080 이하로 스케일", () => {
    const probe = { durationSec: 10, width: 1080, height: 1920 };
    const result = buildFfmpegArgs("/tmp/input.mp4", "/tmp/output.mp4", probe, false);

    const vfIndex = result.args.indexOf("-vf");
    assert.ok(vfIndex >= 0, "-vf 옵션 존재");
    const vfValue = result.args[vfIndex + 1];
    assert.ok(vfValue.includes("scale=-2:1080"), `세로 영상 스케일: ${vfValue}`);
  });

  it("가로 영상(1920x1080): 긴 변 1080 이하로 스케일", () => {
    const probe = { durationSec: 10, width: 1920, height: 1080 };
    const result = buildFfmpegArgs("/tmp/input.mp4", "/tmp/output.mp4", probe, false);

    const vfIndex = result.args.indexOf("-vf");
    const vfValue = result.args[vfIndex + 1];
    assert.ok(vfValue.includes("scale=1080:-2"), `가로 영상 스케일: ${vfValue}`);
  });

  it("작은 영상(640x480): 스케일 없음", () => {
    const probe = { durationSec: 3, width: 640, height: 480 };
    const result = buildFfmpegArgs("/tmp/input.mp4", "/tmp/output.mp4", probe, false);

    const vfIndex = result.args.indexOf("-vf");
    const vfValue = result.args[vfIndex + 1];
    assert.ok(!vfValue.includes("scale="), `작은 영상 스케일 없음: ${vfValue}`);
    assert.ok(vfValue.includes("fps=30"), "fps=30 필터만");
  });
});

describe("buildThumbnailArgs", () => {
  it("1초 지점 썸네일, 320 너비, jpg 품질 3", () => {
    const args = buildThumbnailArgs("/tmp/input.mp4", "/tmp/thumb.jpg", 1);

    assert.ok(args.includes("-ss"), "-ss 옵션");
    assert.ok(args.includes("1"), "1초 지점");
    assert.ok(args.includes("-vframes"), "-vframes 옵션");
    assert.ok(args.includes("-vf"), "-vf 옵션");

    const vfIndex = args.indexOf("-vf");
    assert.ok(args[vfIndex + 1].includes("scale=320:-2"), "320 너비 스케일");
    assert.ok(args.includes("-q:v"), "품질 옵션");
    assert.ok(args.includes("3"), "품질 3");
  });
});
