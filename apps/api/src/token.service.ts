import { createHmac, timingSafeEqual } from "crypto";
import { Injectable } from "@nestjs/common";

export type AccessToken = {
  sub: string;
  email: string;
  role: string;
  tv: number;
  exp: number;
};

@Injectable()
export class TokenService {
  private readonly secret = process.env.JWT_ACCESS_SECRET ?? "mvn-local-dev-secret";

  sign(account: { id: string; email: string; role: string; tokenVersion: number }) {
    const payload: AccessToken = {
      sub: account.id,
      email: account.email,
      role: account.role,
      tv: account.tokenVersion,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.secret).update(body).digest("base64url");
    return `${body}.${signature}`;
  }

  verify(token: string): AccessToken | null {
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    const expected = createHmac("sha256", this.secret).update(body).digest("base64url");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as AccessToken;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.tv !== "number") return null;
    return payload;
  }
}
