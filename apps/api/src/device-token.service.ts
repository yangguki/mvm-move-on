import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Injectable } from "@nestjs/common";

export type DeviceToken = {
  storeId: string;
  deviceId: string;
  exp: number;
};

@Injectable()
export class DeviceTokenService {
  private readonly secret = process.env.JWT_DEVICE_SECRET ?? "mvn-device-secret";

  sign(storeId: string, deviceId: string): string {
    const payload: DeviceToken = {
      storeId,
      deviceId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.secret).update(body).digest("base64url");
    return `${body}.${signature}`;
  }

  verify(token: string): DeviceToken | null {
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    const expected = createHmac("sha256", this.secret).update(body).digest("base64url");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as DeviceToken;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  }

  generatePairingCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
}
