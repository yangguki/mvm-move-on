import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("health")
  async getHealth() {
    const body = await this.health.check();
    if (!body.ok) {
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }
}
