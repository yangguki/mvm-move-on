#!/usr/bin/env node
/**
 * 스킨 스크린샷 생성 스크립트
 * 4종 스킨의 4개 상태(카운트다운, 운동, 휴식, 완료)를 1920x1080 해상도로 캡처합니다.
 * wod-chalkboard는 제외합니다.
 */

import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "docs", "skins");
const PLAYER_URL = "http://localhost:3000/skins/neon-arcade/index.html";

const SKINS = ["neon-arcade", "iron-gym", "live-broadcast", "power-energy"];
const STATES = ["countdown", "exercise", "rest", "complete"];

function makeProgram(skinId, stateId) {
  const items = [];
  if (stateId === "countdown") {
    items.push({ id: "cd1", type: "countdown", durationSec: 10, label: "준비" });
    items.push({ id: "ex1", type: "exercise", durationSec: 45, label: "덤벨 숄더 프레스", videoId: "v1", reps: 12 });
    items.push({ id: "ex2", type: "exercise", durationSec: 45, label: "얼터네이트 숄더 프레스", videoId: "v1", reps: 10 });
  } else if (stateId === "rest") {
    items.push({ id: "rs1", type: "rest", durationSec: 60, label: "휴식" });
    items.push({ id: "ex1", type: "exercise", durationSec: 45, label: "얼터네이트 숄더 프레스", videoId: "v1", reps: 10 });
  } else if (stateId === "complete") {
    items.push({ id: "ex1", type: "exercise", durationSec: 45, label: "덤벨 숄더 프레스", videoId: "v1", reps: 12 });
    items.push({ id: "ex2", type: "exercise", durationSec: 45, label: "얼터네이트 숄더 프레스", videoId: "v1", reps: 10 });
  } else {
    items.push({ id: "ex1", type: "exercise", durationSec: 45, label: "덤벨 숄더 프레스", videoId: "v1", reps: 12 });
    items.push({ id: "ex2", type: "exercise", durationSec: 45, label: "얼터네이트 숄더 프레스", videoId: "v1", reps: 10 });
    items.push({ id: "rs1", type: "rest", durationSec: 15, label: "휴식" });
  }
  return {
    id: "screenshot",
    name: "스크린샷 데모",
    skin: { id: skinId },
    items,
    videos: {
      v1: { id: "v1", name: "덤벨 숄더 프레스", url: "mvn_shoulder_press.mp4", thumbnailUrl: "rest_image.jpg" },
    },
  };
}

async function main() {
  console.log("스킨 스크린샷 생성 시작...\n");

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
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
      console.log(`[${skin}]`);

      for (const state of STATES) {
        await page.goto(PLAYER_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
        
        const program = makeProgram(skin, state);
        
        await page.evaluate(
          (prog, stateId) => {
            window.postMessage({ type: "mvn:program", program: prog, loop: false }, "*");
            setTimeout(() => {
              const stage = document.getElementById("stage");
              if (stage) stage.setAttribute("data-state", stateId);
              const snd = document.getElementById("snd");
              if (snd) snd.style.display = "none";
            }, 100);
          },
          program,
          state
        );

        await new Promise((r) => setTimeout(r, 1500));

        const outputPath = join(OUTPUT_DIR, `${skin}-${state}.png`);
        await page.screenshot({ path: outputPath, type: "png" });
        console.log(`  [OK] ${state} → ${outputPath}`);
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
