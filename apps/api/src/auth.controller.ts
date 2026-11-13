import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { verifyPassword } from "./password";
import { PrismaService } from "./prisma.service";
import { TokenService, type AccessToken } from "./token.service";

type LoginBody = { email?: string; password?: string };

@Controller("admin/v1/auth")
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  @Post("login")
  async login(@Body() body: LoginBody) {
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const account = email
      ? await this.prisma.account.findUnique({ where: { email } })
      : null;
    if (!account || account.status !== "active" || !verifyPassword(password, account.passwordHash)) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않아요");
    }
    await this.prisma.account.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });
    return {
      accessToken: this.tokens.sign(account),
      account: {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        role: account.role,
      },
    };
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@Req() request: { user: AccessToken }) {
    await this.prisma.account.update({
      where: { id: request.user.sub },
      data: { tokenVersion: { increment: 1 } },
    });
  }
}

@Controller("admin/v1")
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  async me(@Req() request: { user: AccessToken }) {
    const account = await this.prisma.account.findUnique({ where: { id: request.user.sub } });
    if (!account || account.status !== "active") {
      throw new UnauthorizedException("로그인이 필요해요");
    }
    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: account.role,
    };
  }
}
