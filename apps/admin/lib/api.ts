import { apiBaseUrl, isCloudDataMode } from "./data-mode";

const TOKEN_KEY = "mo_token";
const CLOUD_SESSION_KEY = "mo_cloud_session";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, keep: boolean) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  const store = keep ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function setCloudSession(keep: boolean) {
  localStorage.removeItem(CLOUD_SESSION_KEY);
  sessionStorage.removeItem(CLOUD_SESSION_KEY);
  const store = keep ? localStorage : sessionStorage;
  store.setItem(CLOUD_SESSION_KEY, "1");
}

export function clearCloudSession() {
  localStorage.removeItem(CLOUD_SESSION_KEY);
  sessionStorage.removeItem(CLOUD_SESSION_KEY);
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  if (isCloudDataMode()) {
    return (
      localStorage.getItem(CLOUD_SESSION_KEY) === "1" || sessionStorage.getItem(CLOUD_SESSION_KEY) === "1"
    );
  }
  return !!getToken();
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${normalized}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

function messageOf(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  }
  return fallback;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const cloud = isCloudDataMode();
  if (!cloud) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: cloud ? "include" : init.credentials,
  });
  if (response.status === 401 && path !== "/admin/v1/auth/login") {
    if (cloud) clearCloudSession();
    else clearToken();
    window.location.assign("/login");
    return new Promise(() => undefined) as Promise<T>;
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(messageOf(body, "요청에 실패했어요"), response.status, body);
  return body as T;
}