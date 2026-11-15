import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { DeviceTokenService, type DeviceToken } from "./device-token.service";

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly tokens: DeviceTokenService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { "x-device-token"?: string };
      device?: DeviceToken;
    }>();
    const token = request.headers["x-device-token"] ?? "";
    const payload = token ? this.tokens.verify(token) : null;
    if (!payload) throw new UnauthorizedException("기기 인증이 필요해요");
    request.device = payload;
    return true;
  }
}
