import { Injectable } from '@nestjs/common';
import { ValkeyService } from '@omnixys/cache';
import { RateLimitStore } from '@omnixys/security';

@Injectable()
export class ValkeyRateLimitStore implements RateLimitStore {
  constructor(private readonly valkey: ValkeyService) {}

  async incr(key: string): Promise<number> {
    return this.valkey.increment(key);
  }

  async get(key: string): Promise<string | null> {
    return this.valkey.rawGet(key);
  }

  async set(
    key: string,
    value: string,
    options?: { EX?: number },
  ): Promise<void> {
    await this.valkey.rawSet(key, value, options?.EX);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.valkey.expire(key, seconds);
  }

  async del(key: string): Promise<void> {
    await this.valkey.client.del(key);
  }

  async ttl(key: string): Promise<number> {
    return this.valkey.client.ttl(key);
  }
}
