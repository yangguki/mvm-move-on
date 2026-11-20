import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  countStoresNeedingAttention,
  deviceListSummaryFromGroupBy,
  filterOfflineDevices,
  filterOnlineDevices,
  filterPlayingDevices,
  storeConnectivityState,
} from "@mvn/shared";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";

@Controller("admin/v1")
@UseGuards(AuthGuard)
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("dashboard")
  async dashboard() {
    const devices = await this.prisma.device.findMany({
      include: { store: true },
      orderBy: { code: "asc" },
    });
    const playing = filterPlayingDevices(devices);
    const online = filterOnlineDevices(devices);
    const offline = filterOfflineDevices(devices);
    const stores = await this.prisma.store.findMany({ include: { devices: true } });
    const attention = countStoresNeedingAttention(stores);
    const now = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(new Date());
    return {
      dateLabel: now,
      programName: playing[0]?.playing ?? null,
      playing: { count: playing.length, total: devices.length },
      online: { count: online.length, total: devices.length },
      stores: { count: stores.length, attention },
      offline: offline.map((device) => ({
        code: device.code,
        name: device.name,
        store: device.store.name,
        seenLabel: device.seenLabel,
      })),
    };
  }

  @Get("stores")
  async stores() {
    const rows = await this.prisma.store.findMany({
      include: { devices: { include: { skin: true } }, program: true },
      orderBy: { name: "asc" },
    });
    const items = rows.map((store) => {
      const online = store.devices.filter((device) => !device.offline).length;
      const offline = store.devices.length - online;
      const skin = store.devices[0]?.skin ?? null;
      const playing = store.devices.find((device) => device.status === "ok")?.playing ?? null;
      const state = storeConnectivityState(offline, store.devices.length);
      return {
        id: store.id,
        name: store.name,
        code: store.code,
        isActive: store.isActive,
        tvCount: store.devices.length,
        online,
        offline,
        programName: playing,
        program: store.program ? { id: store.program.id, name: store.program.name } : null,
        skin: skin ? { id: skin.id, name: skin.name, tone: skin.tone } : null,
        state,
      };
    });
    return {
      summary: {
        storeCount: items.length,
        tvCount: items.reduce((sum, store) => sum + store.tvCount, 0),
      },
      items,
    };
  }

  @Get("devices")
  async devices(@Query("status") status?: string, @Query("q") q?: string, @Query("store") store?: string) {
    const where = {
      ...(status ? { status } : {}),
      ...(store ? { store: { code: store } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { code: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [rows, grouped] = await Promise.all([
      this.prisma.device.findMany({
        where,
        include: { store: true, skin: true },
        orderBy: { code: "asc" },
      }),
      this.prisma.device.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    return {
      summary: deviceListSummaryFromGroupBy(grouped),
      items: rows.map((device) => ({
        id: device.id,
        name: device.name,
        code: device.code,
        store: { id: device.store.id, name: device.store.name, code: device.store.code },
        status: device.status,
        statusLabel: device.statusLabel,
        playing: device.playing,
        progress: device.progress,
        skin: { id: device.skin.id, name: device.skin.name, tone: device.skin.tone },
        appVersion: device.appVersion,
        versionWarn: device.versionWarn,
        seenLabel: device.seenLabel,
        seenAlert: device.seenAlert,
        guide: device.guide,
        offline: device.offline,
        videoLoopMode: device.videoLoopMode,
      })),
    };
  }

}
