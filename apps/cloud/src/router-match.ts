export type RouteAuth = "none" | "admin" | "player";

export type RouteMatch = {
  method: string;
  auth: RouteAuth;
  name: string;
  params: Record<string, string>;
};

type RouteDef = {
  method: string;
  pattern: RegExp;
  auth: RouteAuth;
  name: string;
  paramNames: string[];
};

export const STATIC_ROUTES: Omit<RouteDef, "paramNames">[] = [
  { method: "GET", pattern: /^\/api\/health$/, auth: "none", name: "health" },
  { method: "POST", pattern: /^\/api\/admin\/v1\/auth\/login$/, auth: "none", name: "login" },
  { method: "POST", pattern: /^\/api\/admin\/v1\/auth\/logout$/, auth: "admin", name: "logout" },
  { method: "GET", pattern: /^\/api\/admin\/v1\/me$/, auth: "admin", name: "me" },
  { method: "GET", pattern: /^\/api\/admin\/v1\/dashboard$/, auth: "admin", name: "dashboard" },
  { method: "GET", pattern: /^\/api\/admin\/v1\/stores$/, auth: "admin", name: "stores-list" },
  { method: "POST", pattern: /^\/api\/admin\/v1\/stores$/, auth: "admin", name: "stores-create" },
  { method: "GET", pattern: /^\/api\/admin\/v1\/devices$/, auth: "admin", name: "devices-list" },
  { method: "POST", pattern: /^\/api\/admin\/v1\/pairing-sessions$/, auth: "admin", name: "pairing-sessions" },
  { method: "POST", pattern: /^\/api\/admin\/v1\/approve-pairing$/, auth: "admin", name: "approve-pairing" },
  { method: "GET", pattern: /^\/api\/admin\/v1\/skins$/, auth: "admin", name: "skins-list" },
  { method: "POST", pattern: /^\/api\/admin\/v1\/skins$/, auth: "admin", name: "skins-create" },
  { method: "GET", pattern: /^\/api\/admin\/v1\/videos$/, auth: "admin", name: "videos-list" },
  { method: "POST", pattern: /^\/api\/admin\/v1\/videos$/, auth: "admin", name: "videos-create" },
  { method: "GET", pattern: /^\/api\/admin\/v1\/programs$/, auth: "admin", name: "programs-list" },
  { method: "POST", pattern: /^\/api\/admin\/v1\/programs$/, auth: "admin", name: "programs-create" },
  { method: "POST", pattern: /^\/api\/player\/v1\/code$/, auth: "none", name: "player-code" },
  { method: "GET", pattern: /^\/api\/player\/v1\/programs$/, auth: "player", name: "player-programs-list" },
];

const DYNAMIC_ROUTES: RouteDef[] = [
  {
    method: "GET",
    pattern: /^\/api\/player\/v1\/code\/([^/]+)\/status$/,
    auth: "none",
    name: "player-code-status",
    paramNames: ["code"],
  },
  {
    method: "GET",
    pattern: /^\/api\/player\/v1\/programs\/([^/]+)$/,
    auth: "player",
    name: "player-program-detail",
    paramNames: ["id"],
  },
  {
    method: "PATCH",
    pattern: /^\/api\/admin\/v1\/stores\/([^/]+)$/,
    auth: "admin",
    name: "stores-update",
    paramNames: ["id"],
  },
  {
    method: "DELETE",
    pattern: /^\/api\/admin\/v1\/stores\/([^/]+)$/,
    auth: "admin",
    name: "stores-delete",
    paramNames: ["id"],
  },
  {
    method: "PATCH",
    pattern: /^\/api\/admin\/v1\/devices\/([^/]+)$/,
    auth: "admin",
    name: "devices-update",
    paramNames: ["id"],
  },
  {
    method: "DELETE",
    pattern: /^\/api\/admin\/v1\/devices\/([^/]+)$/,
    auth: "admin",
    name: "devices-delete",
    paramNames: ["id"],
  },
  {
    method: "POST",
    pattern: /^\/api\/admin\/v1\/videos\/upload$/,
    auth: "admin",
    name: "videos-upload",
    paramNames: [],
  },
  {
    method: "GET",
    pattern: /^\/api\/admin\/v1\/videos\/([^/]+)$/,
    auth: "admin",
    name: "videos-detail",
    paramNames: ["id"],
  },
  {
    method: "PATCH",
    pattern: /^\/api\/admin\/v1\/videos\/([^/]+)$/,
    auth: "admin",
    name: "videos-update",
    paramNames: ["id"],
  },
  {
    method: "DELETE",
    pattern: /^\/api\/admin\/v1\/videos\/([^/]+)$/,
    auth: "admin",
    name: "videos-delete",
    paramNames: ["id"],
  },
  {
    method: "POST",
    pattern: /^\/api\/admin\/v1\/programs\/([^/]+)\/publish$/,
    auth: "admin",
    name: "programs-publish",
    paramNames: ["id"],
  },
  {
    method: "GET",
    pattern: /^\/api\/admin\/v1\/programs\/([^/]+)\/versions$/,
    auth: "admin",
    name: "programs-versions",
    paramNames: ["id"],
  },
  {
    method: "GET",
    pattern: /^\/api\/admin\/v1\/programs\/([^/]+)$/,
    auth: "admin",
    name: "programs-detail",
    paramNames: ["id"],
  },
  {
    method: "PUT",
    pattern: /^\/api\/admin\/v1\/programs\/([^/]+)$/,
    auth: "admin",
    name: "programs-save",
    paramNames: ["id"],
  },
  {
    method: "DELETE",
    pattern: /^\/api\/admin\/v1\/programs\/([^/]+)$/,
    auth: "admin",
    name: "programs-delete",
    paramNames: ["id"],
  },
  {
    method: "GET",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)$/,
    auth: "admin",
    name: "skins-detail",
    paramNames: ["id"],
  },
  {
    method: "PATCH",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)$/,
    auth: "admin",
    name: "skins-update",
    paramNames: ["id"],
  },
  {
    method: "DELETE",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)$/,
    auth: "admin",
    name: "skins-delete",
    paramNames: ["id"],
  },
  {
    method: "POST",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)\/screens\/reorder$/,
    auth: "admin",
    name: "screens-reorder",
    paramNames: ["skinId"],
  },
  {
    method: "GET",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)\/screens\/([^/]+)\/usage$/,
    auth: "admin",
    name: "screens-usage",
    paramNames: ["skinId", "screenId"],
  },
  {
    method: "POST",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)\/screens\/([^/]+)\/duplicate$/,
    auth: "admin",
    name: "screens-duplicate",
    paramNames: ["skinId", "screenId"],
  },
  {
    method: "POST",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)\/screens\/([^/]+)\/move$/,
    auth: "admin",
    name: "screens-move",
    paramNames: ["skinId", "screenId"],
  },
  {
    method: "GET",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)\/screens\/([^/]+)$/,
    auth: "admin",
    name: "screens-detail",
    paramNames: ["skinId", "screenId"],
  },
  {
    method: "PATCH",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)\/screens\/([^/]+)$/,
    auth: "admin",
    name: "screens-update",
    paramNames: ["skinId", "screenId"],
  },
  {
    method: "DELETE",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)\/screens\/([^/]+)$/,
    auth: "admin",
    name: "screens-delete",
    paramNames: ["skinId", "screenId"],
  },
  {
    method: "GET",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)\/screens$/,
    auth: "admin",
    name: "screens-list",
    paramNames: ["skinId"],
  },
  {
    method: "POST",
    pattern: /^\/api\/admin\/v1\/skins\/([^/]+)\/screens$/,
    auth: "admin",
    name: "screens-create",
    paramNames: ["skinId"],
  },
];

export const ROUTES = [...STATIC_ROUTES, ...DYNAMIC_ROUTES];

export function normalizeApiPath(pathParam: string | string[] | undefined): string {
  if (!pathParam) return "/api";
  const segments = Array.isArray(pathParam) ? pathParam : pathParam.split("/").filter(Boolean);
  return `/api/${segments.join("/")}`;
}

export function matchRoute(method: string, path: string): RouteMatch | undefined {
  for (const route of STATIC_ROUTES) {
    if (route.method === method && route.pattern.test(path)) {
      return { method: route.method, auth: route.auth, name: route.name, params: {} };
    }
  }
  for (const route of DYNAMIC_ROUTES) {
    if (route.method !== method) continue;
    const m = path.match(route.pattern);
    if (!m) continue;
    const params: Record<string, string> = {};
    route.paramNames.forEach((name, index) => {
      params[name] = m[index + 1]!;
    });
    return { method: route.method, auth: route.auth, name: route.name, params };
  }
}