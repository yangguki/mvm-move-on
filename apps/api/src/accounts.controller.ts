import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { assertHq, AuthGuard } from "./auth.guard";
import { hashPassword } from "./password";
import { PrismaService } from "./prisma.service";
import type { AccessToken } from "./token.service";

type AccountBody = {
  email?: string;
  displayName?: string;
  role?: string;
  password?: string;
  storeIds?: string[];
  status?: string;
};

const ROLES = new Set(["hq_admin", "store_admin"]);
const STATUSES = new Set(["invited", "active", "disabled"]);

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

@Controller("admin/v1/accounts")
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() request: { user: AccessToken }) {
    assertHq(request.user);
    const rows = await this.prisma.account.findMany({
      include: { stores: { include: { store: true } } },
      orderBy: { email: "asc" },
    });
    return { items: rows.map((account) => this.present(account)) };
  }

  @Post()
  async create(@Req() request: { user: AccessToken }, @Body() body: AccountBody) {
    assertHq(request.user);
    const email = body.email?.trim().toLowerCase() ?? "";
    const role = body.role ?? "";
    if (!email || !ROLES.has(role)) throw new BadRequestException("이메일과 역할이 필요해요");
    const storeIds = body.storeIds ?? [];
    if (role === "store_admin" && storeIds.length === 0) {
      throw new BadRequestException("지점 관리자는 소속 지점이 필요해요");
    }
    if (body.password && body.password.length < 8) throw new BadRequestException("비밀번호는 8자 이상이어야 해요");
    const password = body.password ?? randomBytes(9).toString("base64url");
    const status = body.password ? "active" : "invited";
    try {
      const account = await this.prisma.account.create({
        data: {
          email,
          displayName: body.displayName?.trim() || null,
          role: role as "hq_admin" | "store_admin",
          status,
          passwordHash: hashPassword(password),
          stores: { create: storeIds.map((storeId) => ({ storeId })) },
        },
        include: { stores: { include: { store: true } } },
      });
      return {
        account: this.present(account),
        temporaryPassword: body.password ? null : password,
      };
    } catch (error) {
      if (isUnique(error)) throw new ConflictException("이미 있는 이메일이에요");
      throw error;
    }
  }

  @Patch(":id")
  async update(@Req() request: { user: AccessToken }, @Param("id") id: string, @Body() body: AccountBody) {
    assertHq(request.user);
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new BadRequestException("계정을 찾을 수 없어요");
    if (body.status && !STATUSES.has(body.status)) throw new BadRequestException("상태 값이 올바르지 않아요");
    const storeIds = body.storeIds;
    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id },
        data: {
          displayName: body.displayName === undefined ? undefined : body.displayName.trim() || null,
          status: body.status as "invited" | "active" | "disabled" | undefined,
        },
      });
      if (storeIds) {
        await tx.accountStore.deleteMany({ where: { accountId: id } });
        if (storeIds.length > 0) {
          await tx.accountStore.createMany({ data: storeIds.map((storeId) => ({ accountId: id, storeId })) });
        }
      }
    });
    const updated = await this.prisma.account.findUnique({
      where: { id },
      include: { stores: { include: { store: true } } },
    });
    return this.present(updated!);
  }

  private present(account: {
    id: string;
    email: string;
    displayName: string | null;
    role: string;
    status: string;
    lastLoginAt: Date | null;
    stores: Array<{ store: { id: string; name: string; code: string } }>;
  }) {
    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: account.role,
      status: account.status,
      lastLoginAt: account.lastLoginAt,
      stores: account.stores.map((row) => row.store),
    };
  }
}
