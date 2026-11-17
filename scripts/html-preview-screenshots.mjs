#!/usr/bin/env node
/** neon-arcade HTML 화면 + 샘플 스킨 미리보기 스크린샷 → docs/skins/ */
import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildHtmlSkinSrcdoc, HTML_SKIN_SAMPLE_TOKENS } from "../packages/shared/dist/index.js";
import {
  loadNeonArcadeHtmlScreens,
  neonArcadeScreenshotFilename,
} from "../packages/shared/neon-arcade-screens/load.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "docs", "skins");
/** puppeteer setContent 연속 호출 시 CSP nonce 충돌 방지 */
const SCREENSHOT_NONCE = "mvn-html-preview-screenshot";

const SAMPLE_ADMIN_SCREENS = [
  {
    file: "html-preview-exercise.png",
    html: `<span class="stage">
  <h1 style="font-size:64px;color:{{pointColor}}">{{label}}</h1>
  <p style="font-size:96px;margin:0">{{remainingSec}}</p>
  <div data-mvn-video style="width:720px;height:405px;background:#1a1f28;border-radius:20px;margin-top:32px"></div>
</span>`,
    css: `.stage{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;position:relative;background:linear-gradient(180deg,#0a0e12,#141a22);color:#fff;font-family:system-ui,sans-serif}`,
  },
  {
    file: "html-preview-title-only.png",
    html: `<span class="title-only">
  <h1 style="font-size:120px;color:{{pointColor}};text-align:center;width:100%">{{label}}</h1>
  <p style="font-size:36px;text-align:center;opacity:0.7">{{program.name}}</p>
</span>`,
    css: `.title-only{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0a0e12;color:#fff}`,
  },
];

function fillCssTokens(css, tokens) {
  return css.replace(/\{\{([^{}]+)\}\}/g, (_, key) => {
    const v = tokens[String(key).trim()];
    return v == null ? "" : String(v);
  });
}

async function shootScreen(page, { html, css, file }, tokens, csp) {
  const srcdoc = buildHtmlSkinSrcdoc(html, fillCssTokens(css, tokens), csp, SCREENSHOT_NONCE);
  await page.setContent(srcdoc, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    window.postMessage({ type: "mvn:html-skin-tokens", tokens: t }, "*");
  }, tokens);
  await page.waitForFunction(
    () => {
      const mount = document.getElementById("mvn-screen");
      if (!mount) return false;
      return !/\{\{[^{}]+\}\}/.test(mount.textContent || "");
    },
    { timeout: 5000 },
  );
  await new Promise((r) => setTimeout(r, 150));
  const path = join(OUT, file);
  await page.screenshot({ path, fullPage: false });
  console.log("wrote", path);
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const tokens = { ...HTML_SKIN_SAMPLE_TOKENS };
  const csp = {
    imgSrc: "http://localhost:3099",
    mediaSrc: "http://localhost:3099",
    fontSrc: "http://localhost:3099",
  };

  for (const screen of loadNeonArcadeHtmlScreens()) {
    await shootScreen(
      page,
      { html: screen.html, css: screen.css, file: neonArcadeScreenshotFilename(screen.title) },
      tokens,
      csp,
    );
  }

  for (const screen of SAMPLE_ADMIN_SCREENS) {
    await shootScreen(page, screen, tokens, csp);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});