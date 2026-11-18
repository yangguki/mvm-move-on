import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCREENS_DIR = dirname(fileURLToPath(import.meta.url));

function readFragment(name) {
  return readFileSync(join(SCREENS_DIR, name), "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

function assembleHtml(raw) {
  const decor = readFragment("_decor.html");
  const muscles = readFragment("_muscles.html");
  return raw
    .replace(/<!--DECOR-->/g, decor)
    .replace(/<!--MUSCLES-->/g, muscles)
    .trim();
}

export function loadIptPowerBellManifest() {
  return JSON.parse(readFileSync(join(SCREENS_DIR, "manifest.json"), "utf8"));
}

export function loadIptPowerBellHtmlScreens() {
  const manifest = loadIptPowerBellManifest();
  const baseCss = readFileSync(join(SCREENS_DIR, "base.css"), "utf8");
  return manifest.screens.map((screen, sortOrder) => ({
    slug: screen.slug,
    title: screen.title,
    html: assembleHtml(readFileSync(join(SCREENS_DIR, screen.htmlFile), "utf8")),
    css: baseCss,
    hasVideoSlot: screen.hasVideoSlot,
    hasNextVideoSlot: screen.hasNextVideoSlot,
    titleOnly: screen.titleOnly,
    sortOrder,
  }));
}

export function iptPowerBellScreenshotFilename(slugOrTitle) {
  return `${slugOrTitle}.png`;
}
