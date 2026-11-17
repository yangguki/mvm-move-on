import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCREENS_DIR = dirname(fileURLToPath(import.meta.url));

export function loadNeonArcadeManifest() {
  return JSON.parse(readFileSync(join(SCREENS_DIR, "manifest.json"), "utf8"));
}

export function loadNeonArcadeHtmlScreens() {
  const manifest = loadNeonArcadeManifest();
  const baseCss = readFileSync(join(SCREENS_DIR, "base.css"), "utf8");
  return manifest.screens.map((screen, sortOrder) => ({
    title: screen.title,
    html: readFileSync(join(SCREENS_DIR, screen.htmlFile), "utf8").trim(),
    css: baseCss,
    hasVideoSlot: screen.hasVideoSlot,
    hasNextVideoSlot: screen.hasNextVideoSlot,
    titleOnly: screen.titleOnly,
    sortOrder,
  }));
}

export function neonArcadeScreenshotFilename(title) {
  return `neon-html-${title}.png`;
}