#!/usr/bin/env node
/** HTML 스킨 관리자 미리보기 스크린샷 → docs/skins/html-preview-*.png */
import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildHtmlSkinSrcdoc, HTML_SKIN_SAMPLE_TOKENS } from "../packages/shared/dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "docs", "skins");

const SCREENS = [
  {
    file: "html-preview-exercise.png",
    html: `<div data-mvn-video style="width:720px;height:405px;background:#333;border-radius:16px"></div>
<h1 style="font-size:64px;color:{{pointColor}}">{{label}}</h1><p style="font-size:72px">{{remainingSec}}</p>`,
    css: "body{margin:0;background:#0a0e12;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:system-ui}",
  },
  {
    file: "html-preview-title-only.png",
    html: `<h1 style="font-size:96px;color:{{pointColor}}">{{label}}</h1><p>{{program.name}}</p>`,
    css: "body{margin:0;background:#111;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh}",
  },
];

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  for (const screen of SCREENS) {
    const srcdoc = buildHtmlSkinSrcdoc(screen.html, screen.css, {
      imgSrc: "http://localhost:3000",
      mediaSrc: "http://localhost:3000",
      fontSrc: "http://localhost:3000",
    });
    await page.setContent(srcdoc, { waitUntil: "domcontentloaded" });
    await page.evaluate((tokens) => {
      window.postMessage({ type: "mvn:html-skin-tokens", tokens }, "*");
    }, HTML_SKIN_SAMPLE_TOKENS);
    await new Promise((r) => setTimeout(r, 300));
    const path = join(OUT, screen.file);
    await page.screenshot({ path, fullPage: false });
    console.log("wrote", path);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});