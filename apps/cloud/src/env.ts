export type CloudEnv = {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  JWT_DEVICE_SECRET?: string;
};