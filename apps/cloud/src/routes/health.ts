import type { CloudEnv } from "../env";
import { json } from "../http";
import { first } from "../db";

export async function handleHealth(env: CloudEnv): Promise<Response> {
  let d1: "up" | "down" = "down";
  try {
    await first(env.DB, "SELECT 1 AS ok");
    d1 = "up";
  } catch {
    d1 = "down";
  }
  const services = { d1 };
  const body = { ok: d1 === "up", services };
  if (!body.ok) return json(body, 503);
  return json(body);
}