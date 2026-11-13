const { scryptSync, randomBytes } = require("crypto");
const { PrismaClient } = require("../src/generated/client");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const skins = [
  { slug: "neon", name: "네온 아케이드", tone: "linear-gradient(135deg,#00f0ff,#ff2bd6)", isSystem: true },
  { slug: "iron", name: "아이언 짐", tone: "linear-gradient(135deg,#3b3f45,#9aa0a6)", isSystem: true },
  { slug: "live", name: "라이브 중계", tone: "linear-gradient(135deg,#e11d2e,#1d4ed8)", isSystem: true },
  { slug: "power", name: "파워 에너지", tone: "linear-gradient(135deg,#ff7a00,#ffd400)", isSystem: true },
  { slug: "wod", name: "WOD 칠판", tone: "linear-gradient(135deg,#1f3a2e,#e8e4d8)", isSystem: true },
];

const stores = [
  { code: "CX", name: "삼성코엑스점" },
  { code: "BS", name: "안양비산점" },
  { code: "WJ", name: "위례중앙점" },
  { code: "SB", name: "수지성복역점" },
  { code: "PC", name: "안양평촌점" },
  { code: "GY", name: "거여역점" },
  { code: "SS", name: "수서역점" },
];

const devices = [
  { code: "TV-CX-01", name: "iPT존 메인 TV", store: "CX", skin: "neon", status: "ok", statusLabel: "재생 중", playing: "금 머슬핏 A", progress: 81, appVersion: "1.4.2", seenLabel: "방금" },
  { code: "TV-CX-02", name: "iPT존 서브 TV", store: "CX", skin: "neon", status: "ok", statusLabel: "재생 중", playing: "금 머슬핏 A", progress: 81, appVersion: "1.4.2", seenLabel: "방금" },
  { code: "TV-BS-01", name: "iPT존 메인 TV", store: "BS", skin: "iron", status: "err", statusLabel: "오프라인", playing: null, appVersion: "1.4.1", versionWarn: true, seenLabel: "42분 전", seenAlert: true, guide: true, offline: true },
  { code: "TV-BS-03", name: "머신존 TV 2", store: "BS", skin: "iron", status: "err", statusLabel: "오프라인", playing: null, appVersion: "1.4.1", versionWarn: true, seenLabel: "38분 전", seenAlert: true, guide: true, offline: true },
  { code: "TV-WJ-01", name: "iPT존 메인 TV", store: "WJ", skin: "live", status: "ok", statusLabel: "재생 중", playing: "금 머슬핏 A", progress: 79, appVersion: "1.4.2", seenLabel: "방금" },
  { code: "TV-SB-01", name: "iPT존 메인 TV", store: "SB", skin: "power", status: "neutral", statusLabel: "대기", playing: "16:00 머슬핏 B", appVersion: "1.4.2", seenLabel: "12초 전" },
  { code: "TV-SB-02", name: "머신존 TV 1", store: "SB", skin: "power", status: "info", statusLabel: "업데이트 중", playing: "앱 1.4.2 받는 중 · 64%", appVersion: "1.3.9", versionWarn: true, seenLabel: "1분 전" },
  { code: "TV-PC-01", name: "iPT존 메인 TV", store: "PC", skin: "wod", status: "ok", statusLabel: "재생 중", playing: "금 머슬핏 A", progress: 80, appVersion: "1.4.2", seenLabel: "방금" },
  { code: "TV-GY-01", name: "iPT존 메인 TV", store: "GY", skin: "neon", status: "neutral", statusLabel: "대기", playing: "16:00 머슬핏 B", appVersion: "1.4.2", seenLabel: "8초 전" },
  { code: "TV-SS-01", name: "iPT존 메인 TV", store: "SS", skin: "neon", status: "err", statusLabel: "오프라인", playing: null, appVersion: "1.4.2", seenLabel: "3시간 전", seenAlert: true, guide: true, offline: true },
];

async function main() {
  const skinBySlug = new Map();
  for (const skin of skins) {
    const row = await prisma.skin.upsert({
      where: { slug: skin.slug },
      update: skin,
      create: skin,
    });
    skinBySlug.set(skin.slug, row);
  }

  const storeByCode = new Map();
  for (const store of stores) {
    const row = await prisma.store.upsert({
      where: { code: store.code },
      update: { name: store.name },
      create: store,
    });
    storeByCode.set(store.code, row);
  }

  for (const device of devices) {
    const data = {
      name: device.name,
      storeId: storeByCode.get(device.store).id,
      skinId: skinBySlug.get(device.skin).id,
      status: device.status,
      statusLabel: device.statusLabel,
      playing: device.playing ?? null,
      progress: device.progress ?? null,
      appVersion: device.appVersion,
      versionWarn: !!device.versionWarn,
      seenLabel: device.seenLabel,
      seenAlert: !!device.seenAlert,
      guide: !!device.guide,
      offline: !!device.offline,
      videoLoopMode: "ab",
    };
    await prisma.device.upsert({
      where: { code: device.code },
      update: data,
      create: { code: device.code, ...data },
    });
  }

  await prisma.account.upsert({
    where: { email: "inkuk.yang@mvmfit.kr" },
    update: {
      passwordHash: hashPassword("password"),
      displayName: "양인국",
      role: "hq_admin",
      status: "active",
    },
    create: {
      email: "inkuk.yang@mvmfit.kr",
      passwordHash: hashPassword("password"),
      displayName: "양인국",
      role: "hq_admin",
      status: "active",
    },
  });

  await prisma.video.deleteMany();
  const videoPress = await prisma.video.create({
    data: {
      name: "덤벨 숄더 프레스",
      url: "/skins/neon-arcade/mvn_shoulder_press.mp4",
      durationSec: 3,
      thumbnailUrl: "/media/thumb-shoulder-press.jpg",
      width: 1920,
      height: 1080,
    },
  });
  const videoAlt = await prisma.video.create({
    data: {
      name: "얼터네이트 숄더 프레스",
      url: "/skins/neon-arcade/mvn_shoulder_press.mp4",
      durationSec: 4,
      thumbnailUrl: "/media/thumb-alt-press.jpg",
      width: 1920,
      height: 1080,
    },
  });

  await prisma.voicePack.deleteMany();
  await prisma.audioAsset.deleteMany();

  const music = await prisma.audioAsset.create({
    data: {
      name: "기본 배경음악",
      kind: "music",
      url: "/skins/neon-arcade/audio/bgm_gym_loop.mp3",
      durationSec: 1,
      mimeType: "audio/mpeg",
    },
  });
  const cueFiles = [
    ["countdown5", "카운트 5", "/skins/neon-arcade/audio/count_5.mp3"],
    ["countdown4", "카운트 4", "/skins/neon-arcade/audio/count_4.mp3"],
    ["countdown3", "카운트 3", "/skins/neon-arcade/audio/count_3.mp3"],
    ["countdown2", "카운트 2", "/skins/neon-arcade/audio/count_2.mp3"],
    ["countdown1", "카운트 1", "/skins/neon-arcade/audio/count_1.mp3"],
    ["restStart", "휴식 시작", "/skins/neon-arcade/audio/rest_10.mp3"],
  ];
  const cueIds = {};
  for (const [key, name, url] of cueFiles) {
    const row = await prisma.audioAsset.create({
      data: { name, kind: "voice", url, durationSec: 1, mimeType: "audio/mpeg" },
    });
    cueIds[key] = row.id;
  }
  const voicePack = await prisma.voicePack.create({
    data: {
      name: "기본 음성 팩",
      isDefault: true,
      cues: cueIds,
    },
  });

  const draft = {
    items: [
      { id: "guide-1", type: "guide", durationSec: 10, label: "시작 카운트다운", text: "카운트다운" },
      {
        id: "group-a",
        type: "group",
        repeat: 3,
        steps: [
          { id: "ex-1", type: "exercise", durationSec: 45, label: "덤벨 숄더 프레스", videoId: videoPress.id },
          { id: "rest-1", type: "rest", durationSec: 15, label: "휴식" },
          { id: "ex-2", type: "exercise", durationSec: 45, label: "얼터네이트 숄더 프레스", videoId: videoAlt.id },
          { id: "rest-2", type: "rest", durationSec: 15, label: "휴식" },
        ],
      },
      { id: "ex-fin", type: "exercise", durationSec: 40, label: "버닝 피니셔" },
    ],
    skin: {
      id: "neon-arcade",
      options: {
        pointColor: "#C8F31D",
        restImageUrl: "/skins/neon-arcade/rest_image.jpg",
        musicId: music.id,
        voicePackId: voicePack.id,
        nextLeadSec: 10,
      },
    },
  };

  await prisma.programVersion.deleteMany();
  await prisma.program.deleteMany();
  const resolveCue = (key) => {
    const id = cueIds[key];
    const file = cueFiles.find((row) => row[0] === key);
    return {
      id,
      name: file[1],
      url: file[2],
      durationSec: 1,
      mimeType: "audio/mpeg",
    };
  };
  const snapshotSkin = {
    ...draft.skin,
    music: {
      id: music.id,
      name: music.name,
      url: music.url,
      durationSec: music.durationSec,
      mimeType: music.mimeType,
    },
    voicePack: {
      id: voicePack.id,
      name: voicePack.name,
      cues: {
        countdown5: resolveCue("countdown5"),
        countdown4: resolveCue("countdown4"),
        countdown3: resolveCue("countdown3"),
        countdown2: resolveCue("countdown2"),
        countdown1: resolveCue("countdown1"),
        restStart: resolveCue("restStart"),
      },
    },
  };
  const snapshot = {
    id: "seed",
    name: "금 머슬핏 A",
    status: "published",
    draftUpdatedAt: new Date().toISOString(),
    publishedVersion: 1,
    skin: snapshotSkin,
    items: draft.items,
  };
  const program = await prisma.program.create({
    data: {
      name: "금 머슬핏 A",
      status: "published",
      draft,
      draftUpdatedAt: new Date(),
      publishedVersion: 1,
      versions: {
        create: {
          version: 1,
          snapshot: { ...snapshot },
        },
      },
    },
  });

  console.log(`seeded account, stores, devices, videos, audio, voice-pack, program ${program.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
