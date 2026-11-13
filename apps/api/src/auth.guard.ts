import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { TokenService, type AccessToken } from "./token.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: AccessToken }>();
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    const payload = token ? this.tokens.verify(token) : null;
    if (!payload) throw new UnauthorizedException("로그인이 필요해요");
    const account = await this.prisma.account.findUnique({ where: { id: payload.sub } });
    if (!account || account.status !== "active" || account.tokenVersion !== payload.tv) {
      throw new UnauthorizedException("로그인이 필요해요");
    }
    request.user = payload;
    return true;
  }
}

export function assertHq(user: AccessToken) {
  if (user.role !== "hq_admin") throw new ForbiddenException("본사 관리자만 할 수 있어요");
}
