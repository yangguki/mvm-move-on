export function randomPairingCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = buf[0]! % 1_000_000;
  return String(n).padStart(6, "0");
}

export function randomDeviceCode(): string {
  return `TV-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export const PAIRING_TTL_MS = 10 * 60 * 1000;

export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /UNIQUE constraint failed/i.test(error.message);
}