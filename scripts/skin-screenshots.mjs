#!/usr/bin/env node
/**
 * 스킨 스크린샷 생성 스크립트
 * 5종 스킨의 4개 상태(카운트다운, 운동, 휴식, 완료)를 1920x1080 해상도로 캡처합니다.
 */

import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "docs", "skins");
const PLAYER_URL = "http://localhost:3000/skins/neon-arcade/index.html";

const SKINS = [
  {
    slug: "neon-arcade",
    name: "네온 아케이드",
    tokens: {
      primary: "#00F0FF", secondary: "#FF2BD6", accent: "#C8F31D",
      background: "#07051a", surface: "#1b1440", text: "#FFFFFF", textMuted: "#cfc8ff",
      videoRadius: 32, theme: "neon-arcade", countdownLabel: "REST", completeLabel: "COMPLETE!",
    },
  },
  {
    slug: "iron-gym",
    name: "아이언 짐",
    tokens: {
      primary: "#FF5722", secondary: "#5C6269", accent: "#FF5722",
      background: "#1A1C1E", surface: "#2A2D30", text: "#E8E8E8", textMuted: "#8B8D8F",
      videoRadius: 4, theme: "iron-gym", countdownLabel: "BREAK", completeLabel: "DONE",
      warningStripe: "repeating-linear-gradient(45deg,#FF5722 0px,#FF5722 10px,#1A1C1E 10px,#1A1C1E 20px)",
    },
  },
  {
    slug: "live-broadcast",
    name: "라이브 중계",
    tokens: {
      primary: "#E11D2E", secondary: "#1D4ED8", accent: "#FFFFFF",
      background: "#0F1419", surface: "#1E252D", text: "#FFFFFF", textMuted: "#A0AAB4",
      videoRadius: 0, theme: "live-broadcast", countdownLabel: "TIMEOUT", completeLabel: "FINAL",
      liveIndicator: true,
    },
  },
  {
    slug: "power-energy",
    name: "파워 에너지",
    tokens: {
      primary: "#FF7A00", secondary: "#FFD400", accent: "#FFFFFF",
      background: "#0D0D15", surface: "#1A1A2E", text: "#FFFFFF", textMuted: "#8888AA",
      videoRadius: 16, theme: "power-energy", countdownLabel: "RECOVER", completeLabel: "POWER UP!",
    },
  },
  {
    slug: "wod-chalkboard",
    name: "WOD 칠판",
    tokens: {
      primary: "#E8E4D8", secondary: "#8B9A7A", accent: "#FFD93D",
      background: "#1F3A2E", surface: "#2A4A3A", text: "#E8E4D8", textMuted: "#A8B8A0",
      videoRadius: 8, theme: "wod-chalkboard", countdownLabel: "REST", completeLabel: "WOD COMPLETE!",
    },
  },
];

const STATES = [
  { id: "countdown", label: "카운트다운", itemType: "guide" },
  { id: "exercise", label: "운동", itemType: "exercise" },
  { id: "rest", label: "휴식", itemType: "rest" },
  { id: "complete", label: "완료", itemType: "guide" },
];

function makeProgram(skin, state) {
  const restLabel = skin.tokens.countdownLabel || "REST";
  const completeLabel = skin.tokens.completeLabel || "COMPLETE!";
  
  let items;
  if (state.id === "countdown") {
    items = [{ id: "g1", type: "guide", durationSec: 999, label: "준비", text: "시작 준비" }];
  } else if (state.id === "exercise") {
    items = [{ id: "e1", type: "exercise", durationSec: 999, label: "숄더 프레스", videoId: "v1" }];
  } else if (state.id === "rest") {
    items = [{ id: "r1", type: "rest", durationSec: 999, label: restLabel }];
  } else {
    items = [{ id: "c1", type: "guide", durationSec: 999, label: completeLabel, text: "운동 완료" }];
  }

  return {
    id: "screenshot",
    name: "스크린샷",
    status: "draft",
    draftUpdatedAt: new Date().toISOString(),
    publishedVersion: null,
    skin: {
      id: skin.slug,
      options: { pointColor: skin.tokens.accent || "#C8F31D", nextLeadSec: 0 },
      tokens: skin.tokens,
    },
    items,
    videos: {
      v1: {
        id: "v1",
        name: "숄더 프레스",
        url: "/skins/neon-arcade/mvn_shoulder_press.mp4",
        durationSec: 3,
        thumbnailUrl: "/skins/neon-arcade/rest_image.jpg",
        width: 1920,
        height: 1080,
      },
    },
  };
}

async function main() {
  console.log("스킨 스크린샷 생성 시작...\n");

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 테스트 영상 생성 (ffmpeg testsrc)
  const testVideoPath = join(__dirname, "..", "apps", "admin", "public", "skins", "neon-arcade", "test_video.mp4");
  if (!existsSync(testVideoPath)) {
    console.log("테스트 영상 생성 중...");
    try {
      execSync(`ffmpeg -y -f lavfi -i testsrc=duration=5:size=1920x1080:rate=30 -c:v libx264 -pix_fmt yuv420p "${testVideoPath}" 2>/dev/null`);
      console.log("테스트 영상 생성 완료\n");
    } catch {
      console.log("WARNING: ffmpeg testsrc 생성 실패, 기존 영상 사용\n");
    }
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"],
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    for (const skin of SKINS) {
      console.log(`[${skin.name}]`);
      
      for (const state of STATES) {
        const program = makeProgram(skin, state);
        
        await page.goto(PLAYER_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
        
        // 플레이어에 프로그램 전송
        await page.evaluate((prog) => {
          window.postMessage({ type: "mvn:program", program: prog, loop: true }, "*");
        }, program);
        
        // 렌더링 대기
        await new Promise((r) => setTimeout(r, 1500));
        
        const outputPath = join(OUTPUT_DIR, `${skin.slug}-${state.id}.png`);
        await page.screenshot({ path: outputPath, type: "png" });
        console.log(`  [OK] ${state.label} → ${outputPath}`);
      }
      console.log("");
    }

    console.log("스크린샷 생성 완료!");
    console.log(`총 ${SKINS.length * STATES.length}개 파일 → ${OUTPUT_DIR}`);
  } catch (err) {
    console.error("스크린샷 생성 실패:", err.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

main();
