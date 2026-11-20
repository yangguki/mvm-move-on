export function filterPlayingDevices<T extends { status: string }>(devices: T[]): T[] {
  return devices.filter((device) => device.status === "ok");
}

export function filterOnlineDevices<T extends { offline: boolean }>(devices: T[]): T[] {
  return devices.filter((device) => !device.offline);
}

export function filterOfflineDevices<T extends { offline: boolean }>(devices: T[]): T[] {
  return devices.filter((device) => device.offline);
}

export function countStoresNeedingAttention<T extends { devices: { offline: boolean }[] }>(stores: T[]): number {
  return stores.filter((store) => store.devices.some((device) => device.offline)).length;
}

export function storeConnectivityState(offlineCount: number, deviceCount: number): "err" | "info" | "ok" {
  if (offlineCount === deviceCount && deviceCount > 0) return "err";
  if (offlineCount > 0) return "info";
  return "ok";
}

export type DeviceStatusGroupRow = { status: string; _count: { _all: number } };

export function deviceListSummaryFromGroupBy(grouped: DeviceStatusGroupRow[]) {
  const tally = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
  return {
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    playing: tally.ok ?? 0,
    idle: tally.neutral ?? 0,
    updating: tally.info ?? 0,
    offline: tally.err ?? 0,
  };
}

export type AdminDashboardDevice = {
  code: string;
  name: string;
  status: string;
  playing: string | null;
  offline: boolean;
  seenLabel: string;
  store: { name: string };
};

export function buildAdminDashboardResponse(
  devices: AdminDashboardDevice[],
  stores: { devices: { offline: boolean }[] }[],
  now = new Date(),
) {
  const playing = filterPlayingDevices(devices);
  const online = filterOnlineDevices(devices);
  const offline = filterOfflineDevices(devices);
  const attention = countStoresNeedingAttention(stores);
  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
  return {
    dateLabel,
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