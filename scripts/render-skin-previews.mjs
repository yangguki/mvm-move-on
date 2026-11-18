#!/usr/bin/env node
/** ipt-power-bell HTML 화면 미리보기 → ipt-ref/out/<slug>.png */
import puppeteer from "puppeteer";
import { mkdirSync, existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { buildHtmlSkinSrcdoc, HTML_SKIN_SAMPLE_TOKENS } from "../packages/shared/dist/index.js";
import {
  loadIptPowerBellHtmlScreens,
  iptPowerBellScreenshotFilename,
} from "../packages/shared/ipt-power-bell-screens/load.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "..", "ipt-ref", "out");
const SKIN_PUBLIC = join(__dirname, "..", "apps", "admin", "public", "skins", "ipt-power-bell");
const SCREENSHOT_NONCE = "ipt-power-bell-preview";

function fillCssTokens(css, tokens) {
  return css.replace(/\{\{([^{}]+)\}\}/g, (_, key) => {
    const v = tokens[String(key).trim()];
    return v == null ? "" : String(v);
  });
}

function loadSkinAssetDataUrls() {
  const map = new Map();
  if (!existsSync(SKIN_PUBLIC)) return map;
  for (const name of readdirSync(SKIN_PUBLIC)) {
    const ext = extname(name).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext)) continue;
    const mime = ext === ".svg" ? "image/svg+xml" : ext === ".webp" ? "image/webp" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
    const b64 = readFileSync(join(SKIN_PUBLIC, name)).toString("base64");
    map.set(`/skins/ipt-power-bell/${name}`, `data:${mime};base64,${b64}`);
  }
  return map;
}

function inlineSkinAssets(html, assetMap) {
  let out = html;
  for (const [path, dataUrl] of assetMap) {
    out = out.split(path).join(dataUrl);
  }
  return out;
}

async function shootScreen(page, screen, tokens, csp, assetMap) {
  const html = inlineSkinAssets(screen.html, assetMap)
    .replace(
      /data-mvn-next-video/g,
      'data-mvn-next-video style="background:#b0bec5 url(\'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27120%27%3E%3Crect fill=%27%2378909c%27 width=%27200%27 height=%27120%27/%3E%3Ctext x=%27100%27 y=%2765%27 text-anchor=%27middle%27 fill=%27%23fff%27 font-size=%2718%27 font-family=%27sans-serif%27%3ENEXT%3C/text%3E%3C/svg%3E\') center/cover"',
    )
    .replace(
      /data-mvn-video(?!-)/g,
      'data-mvn-video style="background:#cfd8dc url(\'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27120%27%3E%3Crect fill=%27%2390a4ae%27 width=%27200%27 height=%27120%27/%3E%3Ctext x=%27100%27 y=%2765%27 text-anchor=%27middle%27 fill=%27%23fff%27 font-size=%2720%27 font-family=%27sans-serif%27%3EVIDEO%3C/text%3E%3C/svg%3E\') center/cover"',
    );
  const srcdoc = buildHtmlSkinSrcdoc(html, fillCssTokens(screen.css, tokens), csp, SCREENSHOT_NONCE);
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
  await new Promise((r) => setTimeout(r, 200));
  const file = iptPowerBellScreenshotFilename(screen.slug);
  const path = join(OUT, file);
  await page.screenshot({ path, fullPage: false });
  console.log("wrote", path);
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH
    || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  } catch {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath,
      args: ["--no-sandbox"],
    });
  }
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const tokens = {
    ...HTML_SKIN_SAMPLE_TOKENS,
    remainingSec: 14,
    totalSec: 45,
    set: 1,
    round: 1,
    pointColor: "#FF6A45",
    "program.name": "POWER BELL",
  };
  const csp = {
    imgSrc: "'self' data:",
    mediaSrc: "'self' data:",
    fontSrc: "'self' data:",
  };
  const assetMap = loadSkinAssetDataUrls();

  for (const screen of loadIptPowerBellHtmlScreens()) {
    await shootScreen(page, screen, tokens, csp, assetMap);
  }

  await browser.close();
  console.log("done:", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
