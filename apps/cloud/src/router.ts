import { readDeviceTokenHeader, verifyDeviceToken } from "./auth/device-token";
import { resolveAuth } from "./auth/session";
import type { CloudEnv } from "./env";
import { nestError } from "./http";
import { matchRoute, normalizeApiPath, ROUTES } from "./router-match";
import { handleLogin, handleLogout, handleMe } from "./routes/auth";
import { handleDeviceDelete, handleDeviceUpdate, handleDevicesList } from "./routes/devices";
import { handleHealth } from "./routes/health";
import { handleApprovePairing, handleAdminPairingSession } from "./routes/pairing-admin";
import {
  handlePlayerCodeStatus,
  handlePlayerProgramDetail,
  handlePlayerProgramsList,
  handlePlayerRequestCode,
} from "./routes/player";
import { handleDashboard } from "./routes/dashboard";
import { handleStoreCreate, handleStoreDelete, handleStoresList, handleStoreUpdate } from "./routes/stores";
import {
  handleScreenCreate,
  handleScreenDelete,
  handleScreenDuplicate,
  handleScreenGetOne,
  handleScreenMove,
  handleScreenUpdate,
  handleScreenUsage,
  handleScreensList,
  handleScreensReorder,
} from "./routes/skin-screens";
import {
  handleProgramCreate,
  handleProgramDelete,
  handleProgramGet,
  handleProgramPublish,
  handleProgramSave,
  handleProgramsList,
  handleProgramVersions,
} from "./routes/programs";
import {
  handleSkinCreate,
  handleSkinDelete,
  handleSkinDetail,
  handleSkinUpdate,
  handleSkinsList,
} from "./routes/skins";
import {
  handleVideoCreate,
  handleVideoDelete,
  handleVideoGet,
  handleVideosList,
  handleVideoUpdate,
  handleVideoUpload,
} from "./routes/videos";

export type RouteHandler = (
  request: Request,
  env: CloudEnv,
  path: string,
  params: Record<string, string>,
) => Promise<Response>;

const HANDLERS: Record<string, RouteHandler> = {
  health: async (_req, env) => handleHealth(env),
  login: (req, env) => handleLogin(req, env),
  logout: (req, env) => handleLogout(req, env),
  me: (req, env) => handleMe(req, env),
  dashboard: (_req, env) => handleDashboard(_req, env),
  "skins-list": (_req, env) => handleSkinsList(_req, env),
  "skins-create": (req, env) => handleSkinCreate(req, env),
  "skins-detail": (_req, env, _path, params) => handleSkinDetail(_req, env, params.id!),
  "skins-update": (req, env, _path, params) => handleSkinUpdate(req, env, params.id!),
  "skins-delete": (_req, env, _path, params) => handleSkinDelete(_req, env, params.id!),
  "screens-list": (_req, env, _path, params) => handleScreensList(_req, env, params.skinId!),
  "screens-create": (req, env, _path, params) => handleScreenCreate(req, env, params.skinId!),
  "screens-detail": (_req, env, _path, params) => handleScreenGetOne(_req, env, params.skinId!, params.screenId!),
  "screens-usage": (_req, env, _path, params) => handleScreenUsage(_req, env, params.skinId!, params.screenId!),
  "screens-duplicate": (req, env, _path, params) =>
    handleScreenDuplicate(req, env, params.skinId!, params.screenId!),
  "screens-move": (req, env, _path, params) => handleScreenMove(req, env, params.skinId!, params.screenId!),
  "screens-update": (req, env, _path, params) => handleScreenUpdate(req, env, params.skinId!, params.screenId!),
  "screens-delete": (req, env, _path, params) => handleScreenDelete(req, env, params.skinId!, params.screenId!),
  "screens-reorder": (req, env, _path, params) => handleScreensReorder(req, env, params.skinId!),
  "videos-list": (_req, env) => handleVideosList(_req, env),
  "videos-create": (req, env) => handleVideoCreate(req, env),
  "videos-upload": () => handleVideoUpload(),
  "videos-detail": (_req, env, _path, params) => handleVideoGet(_req, env, params.id!),
  "videos-update": (req, env, _path, params) => handleVideoUpdate(req, env, params.id!),
  "videos-delete": (_req, env, _path, params) => handleVideoDelete(_req, env, params.id!),
  "programs-list": (_req, env) => handleProgramsList(_req, env),
  "programs-create": (req, env) => handleProgramCreate(req, env),
  "programs-detail": (_req, env, _path, params) => handleProgramGet(_req, env, params.id!),
  "programs-save": (req, env, _path, params) => handleProgramSave(req, env, params.id!),
  "programs-publish": (_req, env, _path, params) => handleProgramPublish(_req, env, params.id!),
  "programs-versions": (_req, env, _path, params) => handleProgramVersions(_req, env, params.id!),
  "programs-delete": (_req, env, _path, params) => handleProgramDelete(_req, env, params.id!),
  "stores-list": (req, env) => handleStoresList(req, env),
  "stores-create": (req, env) => handleStoreCreate(req, env),
  "stores-update": (req, env, _path, params) => handleStoreUpdate(req, env, params.id!),
  "stores-delete": (req, env, _path, params) => handleStoreDelete(req, env, params.id!),
  "devices-list": (req, env) => handleDevicesList(req, env),
  "devices-update": (req, env, _path, params) => handleDeviceUpdate(req, env, params.id!),
  "devices-delete": (req, env, _path, params) => handleDeviceDelete(req, env, params.id!),
  "pairing-sessions": (req, env) => handleAdminPairingSession(req, env),
  "approve-pairing": (req, env) => handleApprovePairing(req, env),
  "player-code": (req, env) => handlePlayerRequestCode(req, env),
  "player-code-status": (req, env, _path, params) => handlePlayerCodeStatus(req, env, params.code!),
  "player-programs-list": (req, env) => handlePlayerProgramsList(req, env),
  "player-program-detail": (req, env, _path, params) => handlePlayerProgramDetail(req, env, params.id!),
};

export { matchRoute, normalizeApiPath };

export async function dispatch(request: Request, env: CloudEnv, path: string): Promise<Response> {
  const route = matchRoute(request.method, path);

  if (!route) {
    if (path.startsWith("/api/admin/")) {
      const token = await resolveAuth(request, env.SESSION_SECRET);
      if (!token) return nestError("로그인이 필요해요", 401);
    }
    return nestError("요청을 찾을 수 없어요", 404);
  }

  if (route.auth === "admin") {
    const token = await resolveAuth(request, env.SESSION_SECRET);
    if (!token) return nestError("로그인이 필요해요", 401);
  }

  if (route.auth === "player") {
    const deviceToken = readDeviceTokenHeader(request);
    const payload = deviceToken ? await verifyDeviceToken(env, deviceToken) : null;
    if (!payload) return nestError("기기 인증이 필요해요", 401);
  }

  const handle = HANDLERS[route.name];
  if (!handle) return nestError("요청을 찾을 수 없어요", 404);
  return handle(request, env, path, route.params);
}

export { ROUTES };