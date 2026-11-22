const SEEN_ALERT_MS = 10 * 60 * 1000;

export function deviceLastSeenLabel(lastSeenAt: string | null, now: Date = new Date()): string {
  if (!lastSeenAt) return "접속 기록 없음";
  const then = new Date(lastSeenAt).getTime();
  if (Number.isNaN(then)) return "접속 기록 없음";
  const diffMs = now.getTime() - then;
  if (diffMs < 60_000) return "방금 전";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function deviceLastSeenAlert(lastSeenAt: string | null, now: Date = new Date()): boolean {
  if (!lastSeenAt) return true;
  const then = new Date(lastSeenAt).getTime();
  if (Number.isNaN(then)) return true;
  return now.getTime() - then > SEEN_ALERT_MS;
}

export function deviceLastSeenPresent(lastSeenAt: string | null, now: Date = new Date()) {
  return {
    lastSeenAt,
    seenLabel: deviceLastSeenLabel(lastSeenAt, now),
    seenAlert: deviceLastSeenAlert(lastSeenAt, now),
  };
}