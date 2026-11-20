import type { AccessTokenPayload } from "./admin-user";
import { nestError } from "../http";

export function assertHq(user: AccessTokenPayload): Response | null {
  if (user.role !== "hq_admin") return nestError("본사 관리자만 할 수 있어요", 403);
  return null;
}