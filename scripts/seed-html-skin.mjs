#!/usr/bin/env node
/**
 * HTML 스킨 시드: 샘플 1종 + neon-arcade 화면 10종 (파일 기반)
 */
import { PrismaClient } from "../packages/db/src/generated/client/index.js";
import {
  loadNeonArcadeHtmlScreens,
  loadNeonArcadeManifest,
} from "../packages/shared/neon-arcade-screens/load.mjs";

const prisma = new PrismaClient();

const EXERCISE_HTML = `<span class="stage">
  <h1 style="font-size:64px;color:{{pointColor}}">{{label}}</h1>
  <p style="font-size:96px;margin:0">{{remainingSec}}</p>
  <div data-mvn-video style="width:720px;height:405px;background:#1a1f28;border-radius:20px;margin-top:32px"></div>
  <div data-mvn-next-video style="width:240px;height:135px;background:#2a3140;border-radius:12px;position:absolute;right:48px;bottom:48px"></div>
</span>`;

const EXERCISE_CSS = `.stage{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;position:relative;background:linear-gradient(180deg,#0a0e12,#141a22);color:#fff;font-family:system-ui,sans-serif}`;

const TITLE_HTML = `<span class="title-only">
  <h1 style="font-size:120px;color:{{pointColor}};text-align:center;width:100%">{{label}}</h1>
  <p style="font-size:36px;text-align:center;opacity:0.7">{{program.name}}</p>
</span>`;

const TITLE_CSS = `.title-only{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0a0e12;color:#fff}`;

async function upsertSampleHtmlSkin() {
  const slug = "sample-html-workout";
  const skin = await prisma.skin.upsert({
    where: { slug },
    update: { name: "샘플 HTML 워크아웃", kind: "html" },
    create: {
      slug,
      name: "샘플 HTML 워크아웃",
      tone: "linear-gradient(135deg,#1a2740,#0d1520)",
      kind: "html",
      tokens: {},
      isBuiltin: false,
      isActive: true,
    },
  });

  await prisma.skinScreen.deleteMany({ where: { skinId: skin.id } });
  await prisma.skinScreen.createMany({
    data: [
      {
        skinId: skin.id,
        title: "운동 (영상)",
        html: EXERCISE_HTML,
        css: EXERCISE_CSS,
        hasVideoSlot: true,
        hasNextVideoSlot: true,
        titleOnly: false,
        sortOrder: 0,
      },
      {
        skinId: skin.id,
        title: "타이틀 전용",
        html: TITLE_HTML,
        css: TITLE_CSS,
        hasVideoSlot: false,
        hasNextVideoSlot: false,
        titleOnly: true,
        sortOrder: 1,
      },
    ],
  });

  console.log(`HTML 스킨 준비됨: ${skin.slug} (${skin.id})`);
}

async function upsertNeonArcadeHtmlSkin() {
  const manifest = loadNeonArcadeManifest();
  const screens = loadNeonArcadeHtmlScreens();

  const existing = await prisma.skin.findUnique({ where: { slug: manifest.slug } });

  const skin = await prisma.skin.upsert({
    where: { slug: manifest.slug },
    update: {
      name: manifest.name,
      tone: manifest.tone,
      kind: "html",
      ...(existing?.tokens && Object.keys(existing.tokens).length > 0 ? { tokens: existing.tokens } : {}),
    },
    create: {
      slug: manifest.slug,
      name: manifest.name,
      tone: manifest.tone,
      kind: "html",
      tokens: existing?.tokens ?? {},
      isBuiltin: true,
      isActive: true,
    },
  });

  await prisma.skinScreen.deleteMany({ where: { skinId: skin.id } });
  await prisma.skinScreen.createMany({
    data: screens.map((s) => ({
      skinId: skin.id,
      title: s.title,
      html: s.html,
      css: s.css,
      hasVideoSlot: s.hasVideoSlot,
      hasNextVideoSlot: s.hasNextVideoSlot,
      titleOnly: s.titleOnly,
      sortOrder: s.sortOrder,
    })),
  });

  console.log(`neon-arcade HTML 화면 ${screens.length}개 준비됨: ${skin.slug} (${skin.id})`);
}

async function main() {
  await upsertSampleHtmlSkin();
  await upsertNeonArcadeHtmlSkin();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});