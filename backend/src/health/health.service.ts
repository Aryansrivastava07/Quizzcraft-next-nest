import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval, Timeout } from '@nestjs/schedule';

/**
 * 14.50 minutes = 14 minutes and 30 seconds = 870 seconds = 870,000 milliseconds.
 * Render free web services spin down after 15 minutes of inactivity.
 * Pinging every 14.50 minutes keeps the instance continuously active.
 */
export const RENDER_KEEPALIVE_INTERVAL_MS = 14.5 * 60 * 1000; // 870,000 ms

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private totalPings = 0;
  private lastPingAt: string | null = null;
  private lastPingStatus: number | null = null;
  private lastPingDurationMs: number | null = null;
  private lastPingError: string | null = null;
  private readonly startedAt = new Date().toISOString();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Resolves the target external URL for the health check.
   * Priority:
   * 1. HEALTH_CHECK_URL (explicit full URL if provided)
   * 2. RENDER_EXTERNAL_URL (Render automatically injects this environment variable)
   * 3. BACKEND_URL / SERVER_URL / API_URL
   * 4. http://localhost:${PORT}
   */
  getTargetHealthUrl(): string {
    const explicitUrl =
      this.configService.get<string>('HEALTH_CHECK_URL') ||
      process.env.HEALTH_CHECK_URL;
    if (explicitUrl) {
      return explicitUrl.trim();
    }

    const renderUrl =
      this.configService.get<string>('RENDER_EXTERNAL_URL') ||
      process.env.RENDER_EXTERNAL_URL;

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      process.env.BACKEND_URL ||
      this.configService.get<string>('SERVER_URL') ||
      process.env.SERVER_URL ||
      this.configService.get<string>('API_URL') ||
      process.env.API_URL;

    const port =
      this.configService.get<string>('PORT') || process.env.PORT || '5000';
    const rawBase = renderUrl || backendUrl || `http://localhost:${port}`;
    const cleanBase = rawBase.trim().replace(/\/+$/, '');

    if (cleanBase.endsWith('/health') || cleanBase.endsWith('/api/health')) {
      return cleanBase;
    }
    return `${cleanBase}/health`;
  }

  /**
   * Return health status payload matching Nest ResponseInterceptor requirements
   */
  getHealthStatus() {
    return {
      message: 'QuizzCraft backend is healthy and active',
      data: {
        status: 'ok',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        serviceStartedAt: this.startedAt,
        environment: process.env.NODE_ENV || 'production',
        renderKeepAlive: {
          enabled: true,
          intervalMinutes: 14.5,
          intervalMs: RENDER_KEEPALIVE_INTERVAL_MS,
          targetUrl: this.getTargetHealthUrl(),
          totalPings: this.totalPings,
          lastPingAt: this.lastPingAt,
          lastPingStatus: this.lastPingStatus,
          lastPingDurationMs: this.lastPingDurationMs,
          lastPingError: this.lastPingError,
        },
      },
    };
  }

  /**
   * Initial self-health ping 15 seconds after app bootstrap
   */
  @Timeout(15000)
  async handleInitialPing() {
    this.logger.log(
      `[Render Keep-Alive] Initializing health check scheduler (cycle: every 14.50 minutes / ${RENDER_KEEPALIVE_INTERVAL_MS}ms). Target: ${this.getTargetHealthUrl()}`,
    );
    await this.pingHealthCheck('initial-startup');
  }

  /**
   * Scheduled keep-alive ping running every 14.50 minutes (870,000 ms)
   * Prevents Render free instances from spinning down after 15 minutes of inactivity.
   */
  @Interval(RENDER_KEEPALIVE_INTERVAL_MS)
  async handleKeepAliveInterval() {
    await this.pingHealthCheck('scheduled-interval-14.5m');
  }

  /**
   * Dispatches an HTTP GET request to the target health check endpoint
   */
  async pingHealthCheck(trigger: string = 'manual') {
    const targetUrl = this.getTargetHealthUrl();
    const startTime = Date.now();
    this.totalPings++;

    try {
      this.logger.log(
        `[Render Keep-Alive #${this.totalPings}] [${trigger}] Dispatching health ping to ${targetUrl}...`,
      );

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'QuizzCraft-Render-KeepAlive/1.0',
          'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(20000), // 20-second timeout
      });

      const durationMs = Date.now() - startTime;
      this.lastPingAt = new Date().toISOString();
      this.lastPingStatus = response.status;
      this.lastPingDurationMs = durationMs;
      this.lastPingError = null;

      if (response.ok) {
        this.logger.log(
          `[Render Keep-Alive #${this.totalPings}] Ping successful! Status: ${response.status} ${response.statusText} (${durationMs}ms)`,
        );
      } else {
        this.logger.warn(
          `[Render Keep-Alive #${this.totalPings}] Ping returned non-2xx status: ${response.status} ${response.statusText} (${durationMs}ms)`,
        );
      }

      return {
        success: response.ok,
        status: response.status,
        durationMs,
        targetUrl,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      this.lastPingAt = new Date().toISOString();
      this.lastPingStatus = null;
      this.lastPingDurationMs = durationMs;
      this.lastPingError = err?.message || 'Unknown network error';

      this.logger.error(
        `[Render Keep-Alive #${this.totalPings}] Ping failed: ${this.lastPingError} (${durationMs}ms). Target was: ${targetUrl}`,
      );

      return {
        success: false,
        status: null,
        error: this.lastPingError,
        durationMs,
        targetUrl,
      };
    }
  }
}
