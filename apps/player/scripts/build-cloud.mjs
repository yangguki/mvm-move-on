import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const playerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(playerRoot, "dist");
const cloudPlayer = path.resolve(playerRoot, "../cloud/public/player");

const NEON_ARCADE_SKIP = new Set(["mvn_shoulder_press.mp4", "mvn_dumbbell.mp4", "loop_x10.mp4", "loop2_x10.mp4"]);

function shouldSkipRelative(rel) {
  const normalized = rel.replace(/\\/g, "/");
  if (!normalized.startsWith("skins/neon-arcade/")) return false;
  return NEON_ARCADE_SKIP.has(path.basename(normalized));
}

function copyDir(src, dest, relBase = "") {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const rel = relBase ? `${relBase}/${name}` : name;
    if (shouldSkipRelative(rel)) continue;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (statSync(from).isDirectory()) {
      copyDir(from, to, rel);
    } else {
      cpSync(from, to);
    }
  }
}

const env = { ...process.env, VITE_MVN_DATA_MODE: "cloud" };
const build = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["run", "build"],
  { cwd: playerRoot, env, stdio: "inherit", shell: process.platform === "win32" },
);
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

if (!existsSync(distDir)) {
  console.error("Expected Vite build at", distDir);
  process.exit(1);
}

if (existsSync(cloudPlayer)) {
  rmSync(cloudPlayer, { recursive: true, force: true });
}
mkdirSync(cloudPlayer, { recursive: true });
copyDir(distDir, cloudPlayer);
console.log("Copied player export to", cloudPlayer);