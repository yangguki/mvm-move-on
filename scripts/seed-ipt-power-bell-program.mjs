#!/usr/bin/env node
/**
 * iPT POWER BELL 샘플 프로그램 시드 (74 steps, idempotent upsert).
 *
 * 사용: DATABASE_URL=... pnpm seed:ipt-power-bell
 * (.env를 읽지 않습니다. 환경변수 DATABASE_URL만 사용.)
 *
 * 게시: draft는 asDraft/validateProgram과 동일하게 정규화하고,
 * ProgramVersion 스냅샷은 POST /admin/v1/programs/:id/publish 와 같은
 * validateProgram({...screens}) + videos 형태로 만듭니다.
 */
import { PrismaClient } from "../packages/db/src/generated/client/index.js";
import {
  assertHtmlSkinContentSize,
  collectScreenIds,
  HTML_SKIN_CONTENT_MAX_BYTES,
  sanitizeHtmlSkinContent,
  validateHtmlProgramSteps,
  validateProgram,
} from "../packages/shared/dist/index.js";
import { loadIptPowerBellManifest } from "../packages/shared/ipt-power-bell-screens/load.mjs";
import { buildIptPowerBellSampleSteps } from "../packages/shared/ipt-power-bell-screens/sample-program-steps.mjs";

const PROGRAM_NAME = "iPT POWER BELL 샘플";
const SKIN_SLUG = "ipt-power-bell";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL 환경변수가 필요해요. (.env는 읽지 않습니다)");
  process.exit(1);
}

const prisma = new PrismaClient();

function presentVideo(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    durationSec: row.durationSec,
    thumbnailUrl: row.thumbnailUrl,
    width: row.width,
    height: row.height,
  };
}

/** apps/api html-skin-publish.presentScreen 과 동일 */
function presentScreen(row) {
  const { html, css } = sanitizeHtmlSkinContent(row.html, row.css);
  return {
    id: row.id,
    title: row.title,
    html,
    css,
    hasVideoSlot: row.hasVideoSlot,
    hasNextVideoSlot: row.hasNextVideoSlot,
    titleOnly: row.titleOnly,
    version: row.version,
  };
}

/** apps/api freezeHtmlSkinScreens 과 동일 (사용 중인 화면만 freeze) */
function freezeHtmlSkinScreens(screenRows, items) {
  const usedIds = new Set(collectScreenIds(items));
  if (usedIds.size === 0 && screenRows.length > 0) {
    const fallback = screenRows.find((s) => s.hasVideoSlot) ?? screenRows[0];
    if (fallback) usedIds.add(fallback.id);
  }
  /** @type {Record<string, ReturnType<typeof presentScreen>>} */
  const map = {};
  for (const row of screenRows) {
    if (!usedIds.has(row.id)) continue;
    assertHtmlSkinContentSize(row.html, row.css, HTML_SKIN_CONTENT_MAX_BYTES);
    map[row.id] = presentScreen(row);
  }
  return map;
}

async function main() {
  const video = await prisma.video.findFirst({
    where: { status: "ready" },
    orderBy: { createdAt: "asc" },
  });
  if (!video) {
    console.error("ready 상태 Video가 DB에 없어요. 영상을 먼저 준비한 뒤 다시 실행하세요. (아무 것도 생성하지 않았습니다)");
    process.exit(1);
  }

  const skin = await prisma.skin.findUnique({ where: { slug: SKIN_SLUG } });
  if (!skin || skin.kind !== "html") {
    console.error(`스킨 '${SKIN_SLUG}'(html)이 없어요. 먼저 pnpm으로 HTML 스킨 시드(scripts/seed-html-skin.mjs)를 실행하세요.`);
    process.exit(1);
  }

  const screenRows = await prisma.skinScreen.findMany({
    where: { skinId: skin.id },
    orderBy: { sortOrder: "asc" },
  });
  const manifest = loadIptPowerBellManifest();
  if (screenRows.length !== manifest.screens.length) {
    console.error(
      `ipt-power-bell 화면 수 불일치: DB ${screenRows.length}개, manifest ${manifest.screens.length}개. seed-html-skin을 먼저 실행하세요.`,
    );
    process.exit(1);
  }

  /** @type {Record<string, string>} */
  const screenIds = {};
  manifest.screens.forEach((screen, index) => {
    screenIds[screen.slug] = screenRows[index].id;
  });

  const rawItems = buildIptPowerBellSampleSteps({
    screenIds: /** @type {any} */ (screenIds),
    videoId: video.id,
  });

  const screenRefs = screenRows.map((row) => ({
    id: row.id,
    hasVideoSlot: row.hasVideoSlot,
    hasNextVideoSlot: row.hasNextVideoSlot,
    titleOnly: row.titleOnly,
  }));
  validateHtmlProgramSteps(rawItems, screenRefs);

  const draftSkin = {
    id: SKIN_SLUG,
    kind: "html",
    options: {
      pointColor: "#FF6A45",
      nextLeadSec: 10,
    },
  };

  // asDraft와 같이 validateProgram으로 items·options 정규화 → draft/snapshot JSON 일치
  const normalizedDraft = validateProgram({
    id: "draft",
    name: PROGRAM_NAME,
    status: "draft",
    draftUpdatedAt: new Date().toISOString(),
    publishedVersion: null,
    skin: draftSkin,
    items: rawItems,
  });
  const draft = {
    items: normalizedDraft.items,
    skin: {
      id: normalizedDraft.skin.id,
      kind: "html",
      options: normalizedDraft.skin.options,
    },
  };

  const existing = await prisma.program.findFirst({ where: { name: PROGRAM_NAME } });
  const version = (existing?.publishedVersion ?? 0) + 1;
  const programId = existing?.id ?? "seed-ipt-power-bell";
  const draftUpdatedAt = new Date().toISOString();

  const screens = freezeHtmlSkinScreens(screenRows, draft.items);
  const videos = { [video.id]: presentVideo(video) };

  // programs.controller publish: validateProgram({...skin,screens, items: draft.items}) + videos
  const snapshot = {
    ...validateProgram({
      id: programId,
      name: PROGRAM_NAME,
      status: "published",
      draftUpdatedAt,
      publishedVersion: version,
      skin: { ...draft.skin, screens },
      items: draft.items,
    }),
    videos,
  };

  let program;
  if (existing) {
    await prisma.programVersion.deleteMany({ where: { programId: existing.id } });
    program = await prisma.program.update({
      where: { id: existing.id },
      data: {
        name: PROGRAM_NAME,
        status: "published",
        draft,
        draftUpdatedAt: new Date(draftUpdatedAt),
        publishedVersion: version,
        versions: {
          create: {
            version,
            snapshot,
          },
        },
      },
    });
    console.log(`업데이트됨: ${program.name} (${program.id}) v${version}, steps=${draft.items.length}, video=${video.name}`);
  } else {
    program = await prisma.program.create({
      data: {
        name: PROGRAM_NAME,
        status: "published",
        draft,
        draftUpdatedAt: new Date(draftUpdatedAt),
        publishedVersion: version,
        versions: {
          create: {
            version,
            snapshot,
          },
        },
      },
    });
    console.log(`생성됨: ${program.name} (${program.id}) v${version}, steps=${draft.items.length}, video=${video.name}`);
  }

  console.log("게시 스냅샷이 포함되어 플레이어에서 바로 쓸 수 있어요.");
  console.log("관리자에서 재게시: POST /admin/v1/programs/" + program.id + "/publish");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
