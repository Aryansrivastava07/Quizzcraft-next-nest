import { Controller, Get, HttpCode } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Root health check endpoint: GET /health
   */
  @Get('health')
  @HttpCode(200)
  getHealth() {
    return this.healthService.getHealthStatus();
  }

  /**
   * Alias health check endpoint: GET /api/health
   */
  @Get('api/health')
  @HttpCode(200)
  getApiHealth() {
    return this.healthService.getHealthStatus();
  }

  /**
   * Manual trigger endpoint for testing or external webhooks: GET /health/trigger-ping
   */
  @Get('health/trigger-ping')
  @HttpCode(200)
  async triggerManualPing() {
    const result = await this.healthService.pingHealthCheck('manual-api-trigger');
    return {
      message: 'Render keep-alive ping executed',
      data: result,
    };
  }
}
