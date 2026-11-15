import { spawn } from "child_process";
import { unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

export type ProbeResult = {
  durationSec: number;
  width: number;
  height: number;
};

export type FfmpegArgs = {
  input: string;
  output: string;
  args: string[];
};

export function buildFfmpegArgs(
  inputPath: string,
  outputPath: string,
  probe: ProbeResult,
  isGif: boolean,
): FfmpegArgs {
  const args: string[] = ["-y", "-i", inputPath];

  if (isGif) {
    args.push("-an");
  } else {
    args.push("-an");
  }

  const maxDim = 1080;
  let scale: string | null = null;
  if (probe.width > maxDim || probe.height > maxDim) {
    if (probe.width >= probe.height) {
      scale = `scale=${maxDim}:-2`;
    } else {
      scale = `scale=-2:${maxDim}`;
    }
  }

  const filters: string[] = [];
  if (scale) filters.push(scale);
  filters.push("fps=30");

  args.push("-vf", filters.join(","));
  args.push("-c:v", "libx264");
  args.push("-profile:v", "high");
  args.push("-level:v", "4.1");
  args.push("-pix_fmt", "yuv420p");
  args.push("-preset", "fast");
  args.push("-crf", "23");
  args.push("-movflags", "+faststart");
  args.push(outputPath);

  return { input: inputPath, output: outputPath, args };
}

export function buildThumbnailArgs(inputPath: string, outputPath: string, atSec: number = 1): string[] {
  return [
    "-y",
    "-i",
    inputPath,
    "-ss",
    String(Math.max(0, atSec)),
    "-vframes",
    "1",
    "-vf",
    "scale=320:-2",
    "-q:v",
    "3",
    outputPath,
  ];
}

async function runCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

export async function probe(inputPath: string): Promise<ProbeResult> {
  const args = [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,duration",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    inputPath,
  ];

  const { stdout } = await runCommand("ffprobe", args);
  const data = JSON.parse(stdout);

  let duration = 0;
  let width = 0;
  let height = 0;

  if (data.streams?.[0]) {
    width = data.streams[0].width || 0;
    height = data.streams[0].height || 0;
    if (data.streams[0].duration) {
      duration = parseFloat(data.streams[0].duration);
    }
  }

  if (!duration && data.format?.duration) {
    duration = parseFloat(data.format.duration);
  }

  return {
    durationSec: Math.max(1, Math.round(duration)),
    width: width || 1920,
    height: height || 1080,
  };
}

export async function transcode(ffmpegArgs: FfmpegArgs): Promise<void> {
  await runCommand("ffmpeg", ffmpegArgs.args);
}

export async function generateThumbnail(inputPath: string, outputPath: string, atSec: number = 1): Promise<void> {
  const args = buildThumbnailArgs(inputPath, outputPath, atSec);
  await runCommand("ffmpeg", args);
}

export async function checkFfmpeg(): Promise<boolean> {
  try {
    await runCommand("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

export function tempPath(ext: string): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `mvn-video-${id}${ext}`);
}

export async function cleanupFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // ignore
  }
}

export async function readFileBuffer(path: string): Promise<Buffer> {
  return readFile(path);
}
