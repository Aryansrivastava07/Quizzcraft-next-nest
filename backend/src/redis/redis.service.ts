import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memoryStore = new Map<string, { value: string; expiresAt: number }>();

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const maskedUrl = redisUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
      console.log(`[Redis] Initializing ioredis connection to ${maskedUrl}...`);
      try {
        this.client = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          retryStrategy: (times) => Math.min(times * 150, 3000),
          connectTimeout: 10000,
        });

        this.client.on('connect', () => {
          console.log(`[Redis] Connection established successfully to ${maskedUrl}`);
        });

        this.client.on('ready', () => {
          console.log(`[Redis] ioredis ready to receive commands`);
        });

        this.client.on('error', (err: any) => {
          console.warn(`[Redis] Connection issue: ${err.message}`);
        });

        this.client.on('close', () => {
          console.log(`[Redis] Connection closed`);
        });

        await this.client.connect();
      } catch (err: any) {
        console.warn(`[Redis] Failed to connect: ${err.message}. Falling back to in-memory store.`);
        this.client = null;
      }
    } else {
      console.log(`[Cache] Using in-memory fallback store (REDIS_URL not configured)`);
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      try {
        return await this.client.get(key);
      } catch (err: any) {
        this.logger.warn(`[Redis] get error for key "${key}": ${err.message}`);
      }
    }
    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlMs: number = 120000): Promise<void> {
    if (this.client) {
      try {
        await this.client.set(key, value, 'PX', ttlMs);
        return;
      } catch (err: any) {
        this.logger.warn(`[Redis] set error for key "${key}": ${err.message}`);
      }
    }
    this.memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.del(key);
        return;
      } catch (err: any) {
        this.logger.warn(`[Redis] del error for key "${key}": ${err.message}`);
      }
    }
    this.memoryStore.delete(key);
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }
}
