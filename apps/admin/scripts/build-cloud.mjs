import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(adminRoot, "out");
const cloudPublic = path.resolve(adminRoot, "../cloud/public");
const playerDir = path.join(cloudPublic, "player");

function copyDir(src, dest, { skipDirNames = [] } = {}) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
  if (skipDirNames.includes(name)) continue;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (statSync(from).isDirectory()) {
      copyDir(from, to, { skipDirNames });
    } else {
      cpSync(from, to);
    }
  }
}

const env = { ...process.env, NEXT_PUBLIC_MVN_DATA_MODE: "cloud" };
const build = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "next", "build"],
  { cwd: adminRoot, env, stdio: "inherit", shell: process.platform === "win32" },
);
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

if (!existsSync(outDir)) {
  console.error("Expected Next export at", outDir);
  process.exit(1);
}

if (existsSync(cloudPublic)) {
  for (const name of readdirSync(cloudPublic)) {
    if (name === "player") continue;
    const target = path.join(cloudPublic, name);
    rmSync(target, { recursive: true, force: true });
  }
} else {
  mkdirSync(cloudPublic, { recursive: true });
}

copyDir(outDir, cloudPublic, { skipDirNames: [] });

if (!existsSync(playerDir)) {
  mkdirSync(playerDir, { recursive: true });
}

console.log("Copied admin export to", cloudPublic, "(preserved public/player)");