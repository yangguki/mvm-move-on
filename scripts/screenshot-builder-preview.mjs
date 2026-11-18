#!/usr/bin/env node
/**
 * Admin 빌더 중앙 미리보기 스크린샷 (HTML 스킨 스텝 3종)
 * → ../ipt-ref/out/builder-1-title.png, builder-2-exercise.png, builder-3-change.png
 *
 * 서버는 이미 떠 있다고 가정 (admin :3000, api :3001). 재시작하지 않음.
 */
import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "..", "ipt-ref", "out");
const ADMIN = process.env.ADMIN_URL || "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL || "inkuk.yang@mvmfit.kr";
const PASSWORD = process.env.ADMIN_PASSWORD || "password";
const PROGRAM_NAME = "iPT POWER BELL 샘플";

const SHOTS = [
  { file: "builder-1-title.png", stepLabel: "WARM UP", note: "warm-up title" },
  // 같은 라벨의 미리보기(10s)가 먼저 있으므로 set= 부제가 있는 운동 세트만
  { file: "builder-2-exercise.png", stepLabel: "1번 운동 동작", subtitleIncludes: "set=", note: "exercise set" },
  { file: "builder-3-change.png", stepLabel: "CHANGE", note: "체인지" },
];

function fail(where, detail) {
  console.error(`[FAIL] ${where}: ${detail}`);
  process.exit(1);
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  const chromePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: existsSync(chromePath) ? chromePath : undefined,
      args: ["--no-sandbox", "--window-size=1440,900"],
      defaultViewport: { width: 1440, height: 900 },
    });
  } catch (err) {
    fail("puppeteer.launch", err.message);
  }

  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  let accessToken = "";
  try {
    const loginRes = await fetch(`${ADMIN}/api/admin/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const loginBody = await loginRes.json().catch(() => ({}));
    if (!loginRes.ok || !loginBody.accessToken) {
      await browser.close();
      fail(
        "login API",
        `status=${loginRes.status} body=${JSON.stringify(loginBody).slice(0, 200)}`,
      );
    }
    accessToken = loginBody.accessToken;
  } catch (err) {
    await browser.close();
    fail("login API fetch", err.message);
  }

  try {
    await page.goto(`${ADMIN}/login`, { waitUntil: "domcontentloaded" });
    await page.evaluate((token) => {
      localStorage.setItem("mo_token", token);
      sessionStorage.setItem("mo_token", token);
    }, accessToken);
    await page.goto(`${ADMIN}/programs`, { waitUntil: "networkidle2" });
  } catch (err) {
    await browser.close();
    fail("goto /programs after token inject", err.message);
  }

  if (page.url().includes("/login")) {
    await browser.close();
    fail("navigation", "redirected back to /login after token inject (auth rejected)");
  }

  try {
    await page.waitForFunction(
      (name) => [...document.querySelectorAll("td strong")].some((el) => el.textContent?.includes(name)),
      {},
      PROGRAM_NAME,
    );
  } catch (err) {
    await browser.close();
    fail("find program in list", `program "${PROGRAM_NAME}" not found (${err.message})`);
  }

  try {
    await page.evaluate((name) => {
      const strong = [...document.querySelectorAll("td strong")].find((el) => el.textContent?.includes(name));
      const row = strong?.closest("tr");
      if (!row) throw new Error("row missing");
      row.click();
    }, PROGRAM_NAME);
    await page.waitForSelector(".step", { timeout: 15000 });
  } catch (err) {
    await browser.close();
    fail("open builder", err.message);
  }

  for (const shot of SHOTS) {
    try {
      const clicked = await page.evaluate(
        ({ label, subtitleIncludes }) => {
          const steps = [...document.querySelectorAll(".step")];
          const match = steps.find((el) => {
            const b = el.querySelector(".nm b");
            if (!b || b.textContent?.trim() !== label) return false;
            if (!subtitleIncludes) return true;
            const small = el.querySelector(".nm small");
            return !!small?.textContent?.includes(subtitleIncludes);
          });
          if (!match) return false;
          match.scrollIntoView({ block: "center" });
          match.click();
          return true;
        },
        { label: shot.stepLabel, subtitleIncludes: shot.subtitleIncludes || "" },
      );
      if (!clicked) {
        await browser.close();
        fail(
          `click step (${shot.note})`,
          `no .step with label "${shot.stepLabel}"${shot.subtitleIncludes ? ` subtitle~${shot.subtitleIncludes}` : ""}`,
        );
      }
      await new Promise((r) => setTimeout(r, 1500));
      const path = join(OUT, shot.file);
      await page.screenshot({ path, fullPage: true });
      console.log("wrote", path);
    } catch (err) {
      await browser.close();
      fail(`screenshot ${shot.file}`, err.message);
    }
  }

  await browser.close();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
