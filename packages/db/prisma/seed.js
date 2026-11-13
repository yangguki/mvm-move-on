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

  for (const device of devices) {
    const data = {
      name: device.name,
      status: device.status,
      statusLabel: device.statusLabel,
      playing: device.playing,
      progress: device.progress ?? null,
      appVersion: device.appVersion,
      versionWarn: device.versionWarn ?? false,
      seenLabel: device.seenLabel,
      seenAlert: device.seenAlert ?? false,
      guide: device.guide ?? false,
      offline: device.offline ?? false,
      videoLoopMode: "ab",
      storeId: storeByCode.get(device.store).id,
      skinId: skinBySlug.get(device.skin).id,
    };
    await prisma.device.upsert({
      where: { code: device.code },
      update: data,
      create: { code: device.code, ...data },
    });
  }

  await prisma.program.deleteMany();
  const steps = [
    { position: 1, kind: "countdown", label: "시작 카운트다운", subtitle: "카운트다운", seconds: 10 },
    { position: 2, kind: "exercise", label: "워밍업 · 제자리 걷기", subtitle: "운동 · 루프", seconds: 120 },
    { position: 3, kind: "exercise", label: "덤벨 숄더 프레스", subtitle: "운동 · 12회", seconds: 45, groupKey: "a", groupLabel: "A 그룹 · 어깨", groupRepeat: 3 },
    { position: 4, kind: "rest", label: "휴식", seconds: 15, groupKey: "a", groupLabel: "A 그룹 · 어깨", groupRepeat: 3 },
    { position: 5, kind: "exercise", label: "얼터네이트 숄더 프레스", subtitle: "운동 · 좌우 10회", seconds: 45, groupKey: "a", groupLabel: "A 그룹 · 어깨", groupRepeat: 3 },
    { position: 6, kind: "rest", label: "휴식", seconds: 15, groupKey: "a", groupLabel: "A 그룹 · 어깨", groupRepeat: 3 },
    { position: 7, kind: "exercise", label: "3번 머신 · 랫 풀다운", subtitle: "운동 · 15회", seconds: 45, groupKey: "m", groupLabel: "머신 서킷", groupRepeat: 4 },
    { position: 8, kind: "rest", label: "휴식 · 중앙으로 이동", seconds: 15, groupKey: "m", groupLabel: "머신 서킷", groupRepeat: 4 },
    { position: 9, kind: "exercise", label: "버피", subtitle: "운동 · 최대 반복", seconds: 40, groupKey: "m", groupLabel: "머신 서킷", groupRepeat: 4 },
    { position: 10, kind: "rest", label: "휴식", seconds: 20, groupKey: "m", groupLabel: "머신 서킷", groupRepeat: 4 },
    { position: 11, kind: "exercise", label: "플랭크", subtitle: "운동", seconds: 45, groupKey: "b", groupLabel: "B 그룹 · 코어", groupRepeat: 3 },
    { position: 12, kind: "rest", label: "휴식", seconds: 15, groupKey: "b", groupLabel: "B 그룹 · 코어", groupRepeat: 3 },
    { position: 13, kind: "exercise", label: "크런치", subtitle: "운동", seconds: 45, groupKey: "b", groupLabel: "B 그룹 · 코어", groupRepeat: 3 },
    { position: 14, kind: "rest", label: "휴식", seconds: 15, groupKey: "b", groupLabel: "B 그룹 · 코어", groupRepeat: 3 },
    { position: 15, kind: "exercise", label: "버닝 피니셔", subtitle: "운동 · 45초/15초 인터벌", seconds: 300 },
    { position: 16, kind: "exercise", label: "쿨다운", subtitle: "운동", seconds: 170 },
  ];
  const program = await prisma.program.create({
    data: {
      name: "금 머슬핏 A",
      status: "draft",
      skinId: skinBySlug.get("neon").id,
      lockVersion: 8,
      draftVersion: 8,
      publishedVersion: 7,
      steps: { create: steps },
      versions: {
        create: {
          version: 7,
          name: "금 머슬핏 A",
          skinId: skinBySlug.get("neon").id,
          steps: { create: steps },
        },
      },
    },
  });

  console.log(`seeded account, ${stores.length} stores, ${devices.length} devices, program ${program.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
