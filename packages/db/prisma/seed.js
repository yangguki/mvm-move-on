const { scryptSync, randomBytes } = require("crypto");
const { PrismaClient } = require("../src/generated/client");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const skins = [
  {
    slug: "neon-arcade",
    name: "네온 아케이드",
    description: "게임 감성의 네온 스타일",
    tone: "linear-gradient(135deg,#00f0ff,#ff2bd6)",
    isBuiltin: true,
    tokens: {
      "--bg": "#07051A",
      "--bg-image": "radial-gradient(ellipse at 50% -10%,#2A0D5C 0%,#07051A 60%)",
      "--fg": "#FFFFFF",
      "--muted": "#CFC8FF",
      "--primary": "#00F0FF",
      "--secondary": "#FF2BD6",
      "--accent": "#B6FF3B",
      "--on-accent": "#07051A",
      "--font-head": "\"MO Pretendard\"",
      "--head-weight": "800",
      "--font-num": "\"MO Mono\"",
      "--num-tracking": "0",
      "--panel-bg": "#120A2E",
      "--panel-border": "2px solid #3A2A7A",
      "--panel-radius": "16px",
      "--panel-shadow": "none",
      "--label-color": "#CFC8FF",
      "--label-font": "\"MO Pretendard\"",
      "--label-size": "22px",
      "--label-tracking": ".14em",
      "--step-color": "var(--accent)",
      "--step-shadow": "0 0 14px rgba(182,255,59,.6)",
      "--name-color": "#FFFFFF",
      "--name-shadow": "0 0 8px #00F0FF,0 0 24px #00F0FF",
      "--name-skew": "0deg",
      "--timer-color": "var(--secondary)",
      "--timer-shadow": "0 0 10px #FF2BD6,0 0 28px rgba(255,43,214,.7)",
      "--tag-bg": "var(--accent)",
      "--tag-fg": "var(--on-accent)",
      "--tag-radius": "10px",
      "--bar-track": "#1B1440",
      "--bar-border": "1px solid #3A2A7A",
      "--bar-fill": "linear-gradient(90deg,#00F0FF,#FF2BD6)",
      "--bar-radius": "6px",
      "--video-radius": "28px",
      "--ring-w": "14px",
      "--ring-color": "#0A0722",
      "--frame-line": "4px solid #00F0FF",
      "--frame-glow": "0 0 28px rgba(0,240,255,.45)",
      "--thumb-radius": "10px",
      "--thumb-line": "3px solid #FF2BD6",
      "--scrim": "rgba(7,5,26,.80)",
      "--state-font": "\"MO Pretendard\"",
      "--state-color": "#FFFFFF",
      "--state-shadow": "0 0 12px #FF2BD6,0 0 36px rgba(255,43,214,.6)",
      "--state-num-color": "var(--accent)",
      "--state-num-shadow": "0 0 24px rgba(182,255,59,.7)",
      "--chip-bg": "#1B1440",
      "--chip-fg": "#FFFFFF",
      "--chip-border": "2px solid #3A2A7A",
      "--chip-radius": "999px",
      "--gauge-track": "#1B1440",
      "--gauge-fill": "linear-gradient(0deg,#00F0FF,#FF2BD6)",
      "--gauge-seg": "0px",
    },
  },
  {
    slug: "iron-gym",
    name: "아이언 짐",
    description: "거친 금속·철판 질감, 굵고 각진 폰트",
    tone: "linear-gradient(135deg,#3b3f45,#9aa0a6)",
    isBuiltin: true,
    tokens: {
      "--bg": "#202428",
      "--bg-image": "url(assets/tex-steel.png)",
      "--fg": "#F3F5F6",
      "--muted": "#A7B0B8",
      "--primary": "#FF6A00",
      "--secondary": "#C9CFD5",
      "--accent": "#FFC21A",
      "--on-accent": "#111315",
      "--font-head": "\"MO BlackHan\"",
      "--head-weight": "400",
      "--font-num": "\"MO ArchivoX\"",
      "--num-tracking": "-.02em",
      "--panel-bg": "linear-gradient(180deg,#3B4147 0%,#2A2F34 100%)",
      "--panel-border": "2px solid #0F1113",
      "--panel-radius": "4px",
      "--panel-shadow": "inset 0 2px 0 rgba(255,255,255,.16),inset 0 -3px 0 rgba(0,0,0,.35),0 6px 0 #0F1113",
      "--label-color": "#FFC21A",
      "--label-font": "\"MO ArchivoX\"",
      "--label-size": "20px",
      "--label-tracking": ".08em",
      "--step-color": "#FFFFFF",
      "--step-shadow": "0 4px 0 #000",
      "--name-color": "#FFFFFF",
      "--name-shadow": "0 5px 0 #000",
      "--name-skew": "0deg",
      "--timer-color": "#FF6A00",
      "--timer-shadow": "0 5px 0 #000",
      "--tag-bg": "#FFC21A",
      "--tag-fg": "#111315",
      "--tag-radius": "2px",
      "--bar-track": "#111315",
      "--bar-border": "2px solid #0A0B0C",
      "--bar-fill": "repeating-linear-gradient(-45deg,#FF6A00 0 18px,#111315 18px 36px)",
      "--bar-radius": "2px",
      "--video-radius": "12px",
      "--ring-w": "10px",
      "--ring-color": "#16191C",
      "--frame-line": "5px solid #FF6A00",
      "--frame-glow": "0 8px 0 #0A0B0C",
      "--thumb-radius": "3px",
      "--thumb-line": "3px solid #FFC21A",
      "--scrim": "rgba(17,19,21,.84)",
      "--state-font": "\"MO BlackHan\"",
      "--state-color": "#FFFFFF",
      "--state-shadow": "0 6px 0 #000",
      "--state-num-color": "#FF6A00",
      "--state-num-shadow": "0 8px 0 #000",
      "--chip-bg": "#2A2F34",
      "--chip-fg": "#fff",
      "--chip-border": "2px solid #0F1113",
      "--chip-radius": "3px",
      "--gauge-track": "#111315",
      "--gauge-fill": "#FF6A00",
      "--gauge-seg": "8px",
      "--gauge-gap": "#202428",
    },
  },
  {
    slug: "live-broadcast",
    name: "라이브 중계",
    description: "스포츠 중계 자막바, LIVE 표시, 스코어보드형 타이머",
    tone: "linear-gradient(135deg,#e11d2e,#1d4ed8)",
    isBuiltin: true,
    tokens: {
      "--bg": "#081634",
      "--bg-image": "repeating-linear-gradient(115deg,rgba(255,255,255,.025) 0 2px,transparent 2px 16px),linear-gradient(180deg,#0C1F4A 0%,#050C20 100%)",
      "--fg": "#FFFFFF",
      "--muted": "#A9BBE0",
      "--primary": "#E10600",
      "--secondary": "#1F52FF",
      "--accent": "#FFC72C",
      "--on-accent": "#081634",
      "--font-head": "\"MO Pretendard\"",
      "--head-weight": "800",
      "--font-num": "\"MO ArchivoC\"",
      "--num-tracking": ".01em",
      "--panel-bg": "#0F2557",
      "--panel-border": "0",
      "--panel-radius": "6px",
      "--panel-shadow": "inset 0 4px 0 #1F52FF,0 6px 16px rgba(0,0,0,.35)",
      "--label-color": "#A9BBE0",
      "--label-font": "\"MO ArchivoC\"",
      "--label-size": "24px",
      "--label-tracking": ".12em",
      "--step-color": "#FFFFFF",
      "--step-shadow": "none",
      "--name-color": "#081634",
      "--name-shadow": "none",
      "--name-skew": "0deg",
      "--timer-color": "#FFC72C",
      "--timer-shadow": "none",
      "--tag-bg": "#1F52FF",
      "--tag-fg": "#FFFFFF",
      "--tag-radius": "3px",
      "--bar-track": "#13285C",
      "--bar-border": "0",
      "--bar-fill": "linear-gradient(90deg,#E10600 0%,#E10600 calc(100% - 24px),#FFC72C calc(100% - 24px))",
      "--bar-radius": "2px",
      "--video-radius": "16px",
      "--ring-w": "8px",
      "--ring-color": "#081634",
      "--frame-line": "3px solid #FFFFFF",
      "--frame-glow": "0 12px 32px rgba(0,0,0,.45)",
      "--thumb-radius": "4px",
      "--thumb-line": "3px solid #FFFFFF",
      "--scrim": "rgba(5,12,32,.84)",
      "--state-font": "\"MO Pretendard\"",
      "--state-color": "#FFFFFF",
      "--state-shadow": "none",
      "--state-num-color": "#FFC72C",
      "--state-num-shadow": "none",
      "--chip-bg": "#FFFFFF",
      "--chip-fg": "#081634",
      "--chip-border": "0",
      "--chip-radius": "4px",
      "--gauge-track": "#13285C",
      "--gauge-fill": "linear-gradient(0deg,#E10600,#FFC72C)",
      "--gauge-seg": "0px",
    },
  },
  {
    slug: "power-energy",
    name: "파워 에너지",
    description: "강한 그라데이션, 대각 패턴, 에너지 게이지",
    tone: "linear-gradient(135deg,#ff7a00,#ffd400)",
    isBuiltin: true,
    tokens: {
      "--bg": "#FF4A1C",
      "--bg-image": "repeating-linear-gradient(-60deg,rgba(255,255,255,.07) 0 40px,transparent 40px 120px),linear-gradient(115deg,#FF1F5A 0%,#FF5A12 48%,#FFB800 100%)",
      "--fg": "#FFFFFF",
      "--muted": "#FFE2CF",
      "--primary": "#FFE600",
      "--secondary": "#111111",
      "--accent": "#FFE600",
      "--on-accent": "#111111",
      "--font-head": "\"MO Pretendard\"",
      "--head-weight": "800",
      "--font-num": "\"MO ArchivoI\"",
      "--num-tracking": "-.02em",
      "--panel-bg": "#111111",
      "--panel-border": "0",
      "--panel-radius": "26px",
      "--panel-shadow": "0 10px 0 rgba(0,0,0,.25)",
      "--label-color": "#FFE600",
      "--label-font": "\"MO ArchivoI\"",
      "--label-size": "24px",
      "--label-tracking": ".06em",
      "--step-color": "#FFFFFF",
      "--step-shadow": "none",
      "--name-color": "#FFFFFF",
      "--name-shadow": "none",
      "--name-skew": "-8deg",
      "--timer-color": "#FFE600",
      "--timer-shadow": "none",
      "--tag-bg": "#FFE600",
      "--tag-fg": "#111111",
      "--tag-radius": "10px",
      "--bar-track": "rgba(17,17,17,.55)",
      "--bar-border": "0",
      "--bar-fill": "#FFE600",
      "--bar-radius": "6px",
      "--video-radius": "40px",
      "--ring-w": "18px",
      "--ring-color": "#111111",
      "--frame-line": "6px solid #FFE600",
      "--frame-glow": "0 14px 0 rgba(0,0,0,.22)",
      "--thumb-radius": "14px",
      "--thumb-line": "4px solid #FFE600",
      "--scrim": "rgba(17,17,17,.80)",
      "--state-font": "\"MO Pretendard\"",
      "--state-color": "#FFFFFF",
      "--state-shadow": "none",
      "--state-num-color": "#FFE600",
      "--state-num-shadow": "none",
      "--chip-bg": "#FFFFFF",
      "--chip-fg": "#111111",
      "--chip-border": "0",
      "--chip-radius": "16px",
      "--gauge-track": "rgba(17,17,17,.6)",
      "--gauge-fill": "linear-gradient(0deg,#FFE600,#FFF6A0)",
      "--gauge-seg": "10px",
      "--gauge-gap": "#111111",
    },
  },
  {
    slug: "wod-chalkboard",
    name: "WOD 칠판",
    description: "칠판 질감, 분필 느낌 폰트, 손글씨풍 테두리",
    tone: "linear-gradient(135deg,#1f3a2e,#e8e4d8)",
    isBuiltin: true,
    tokens: {
      primary: "#E8E4D8",
      secondary: "#8B9A7A",
      accent: "#FFD93D",
      background: "#1F3A2E",
      surface: "#2A4A3A",
      text: "#E8E4D8",
      textMuted: "#A8B8A0",
      fontFamily: "'Caveat', 'Comic Sans MS', cursive",
      borderRadius: 0,
      videoRadius: 8,
      theme: "wod-chalkboard",
      hudStyle: "chalkboard",
      barGradient: "linear-gradient(90deg,#FFD93D,#E8E4D8)",
      frameGlow: "none",
      frameBorder: "4px dashed #8B9A7A",
      bgPattern: "url(\"data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E\")",
      chalkTexture: true,
      handwrittenBorder: true,
      nameStyle: "chalk-text",
      stepLabelStyle: "chalk-box",
      restStyle: "chalk-circle",
      countdownLabel: "REST",
      completeLabel: "WOD COMPLETE!",
    },
  },
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
  { code: "TV-CX-01", name: "iPT존 메인 TV", store: "CX", skin: "neon-arcade", status: "ok", statusLabel: "재생 중", playing: "금 머슬핏 A", progress: 81, appVersion: "1.4.2", seenLabel: "방금" },
  { code: "TV-CX-02", name: "iPT존 서브 TV", store: "CX", skin: "neon-arcade", status: "ok", statusLabel: "재생 중", playing: "금 머슬핏 A", progress: 81, appVersion: "1.4.2", seenLabel: "방금" },
  { code: "TV-BS-01", name: "iPT존 메인 TV", store: "BS", skin: "iron-gym", status: "err", statusLabel: "오프라인", playing: null, appVersion: "1.4.1", versionWarn: true, seenLabel: "42분 전", seenAlert: true, guide: true, offline: true },
  { code: "TV-BS-03", name: "머신존 TV 2", store: "BS", skin: "iron-gym", status: "err", statusLabel: "오프라인", playing: null, appVersion: "1.4.1", versionWarn: true, seenLabel: "38분 전", seenAlert: true, guide: true, offline: true },
  { code: "TV-WJ-01", name: "iPT존 메인 TV", store: "WJ", skin: "live-broadcast", status: "ok", statusLabel: "재생 중", playing: "금 머슬핏 A", progress: 79, appVersion: "1.4.2", seenLabel: "방금" },
  { code: "TV-SB-01", name: "iPT존 메인 TV", store: "SB", skin: "power-energy", status: "neutral", statusLabel: "대기", playing: "16:00 머슬핏 B", appVersion: "1.4.2", seenLabel: "12초 전" },
  { code: "TV-SB-02", name: "머신존 TV 1", store: "SB", skin: "power-energy", status: "info", statusLabel: "업데이트 중", playing: "앱 1.4.2 받는 중 · 64%", appVersion: "1.3.9", versionWarn: true, seenLabel: "1분 전" },
  { code: "TV-PC-01", name: "iPT존 메인 TV", store: "PC", skin: "wod-chalkboard", status: "ok", statusLabel: "재생 중", playing: "금 머슬핏 A", progress: 80, appVersion: "1.4.2", seenLabel: "방금" },
  { code: "TV-GY-01", name: "iPT존 메인 TV", store: "GY", skin: "neon-arcade", status: "neutral", statusLabel: "대기", playing: "16:00 머슬핏 B", appVersion: "1.4.2", seenLabel: "8초 전" },
  { code: "TV-SS-01", name: "iPT존 메인 TV", store: "SS", skin: "neon-arcade", status: "err", statusLabel: "오프라인", playing: null, appVersion: "1.4.2", seenLabel: "3시간 전", seenAlert: true, guide: true, offline: true },
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
  const freezeVideo = (row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    durationSec: row.durationSec,
    thumbnailUrl: row.thumbnailUrl,
    width: row.width,
    height: row.height,
  });
  const snapshot = {
    id: "seed",
    name: "금 머슬핏 A",
    status: "published",
    draftUpdatedAt: new Date().toISOString(),
    publishedVersion: 1,
    skin: snapshotSkin,
    items: draft.items,
    videos: {
      [videoPress.id]: freezeVideo(videoPress),
      [videoAlt.id]: freezeVideo(videoAlt),
    },
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
