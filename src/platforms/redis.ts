import { Redis as UpstashRedis } from '@upstash/redis';
import IoRedis from 'ioredis';

const KEY_TEST = 'test';

const isLocalRedisUrl = (url?: string) =>
  Boolean(url && (url.startsWith('redis://') || url.startsWith('rediss://')));

// Minimal shared surface actually used directly by this app
// (connection warm-up / health check). Both ioredis and
// @upstash/redis implement an async `get`.
interface RedisLike {
  get: (key: string) => Promise<unknown>;
}

const KV_URL = process.env.KV_URL;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;

// Local / self-hosted TCP Redis (redis:// or rediss://) → ioredis
const localRedis: IoRedis | undefined = isLocalRedisUrl(KV_URL)
  ? (() => {
    const client = new IoRedis(KV_URL!, {
      // Fail fast instead of hanging requests when Redis is down
      maxRetriesPerRequest: 1,
      // Avoid an eager connection attempt at import time
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    // Prevent unhandled 'error' events from crashing the process /
    // flooding logs when Redis is temporarily unavailable.
    client.on('error', () => {});
    return client;
  })()
  : undefined;

// Upstash HTTP Redis (https://...) → @upstash/redis.
// This is the only client compatible with @upstash/ratelimit.
const upstashRedis: UpstashRedis | undefined =
  !localRedis && (KV_URL || UPSTASH_URL)
    ? UpstashRedis.fromEnv()
    : (
      !localRedis &&
      process.env.EXIF_KV_REST_API_URL &&
      process.env.EXIF_KV_REST_API_TOKEN
    ) ? new UpstashRedis({
        url: process.env.EXIF_KV_REST_API_URL,
        token: process.env.EXIF_KV_REST_API_TOKEN,
      })
      : undefined;

// Generic client for app-level warm-up / health checks (either backend).
export const redis: RedisLike | undefined = localRedis ?? upstashRedis;

// Strongly-typed Upstash client for @upstash/ratelimit, which is NOT
// compatible with ioredis. Undefined for local Redis → rate limiting
// is skipped gracefully on self-hosted single-node deployments.
export const redisRateLimitClient: UpstashRedis | undefined = upstashRedis;

export const warmRedisConnection = () => {
  if (redis) {
    // fire-and-forget; swallow errors so a cold/unavailable Redis
    // never breaks page rendering
    Promise.resolve(redis.get(KEY_TEST)).catch(() => {});
  }
};

export const testRedisConnection = (): Promise<unknown> => redis
  ? redis.get(KEY_TEST)
  : Promise.reject(new Error('Redis not configured'));
