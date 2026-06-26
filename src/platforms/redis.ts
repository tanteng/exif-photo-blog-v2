import { Redis as UpstashRedis } from '@upstash/redis';
import IoRedis from 'ioredis';

const KEY_TEST = 'test';

const isLocalRedisUrl = (url?: string) =>
  Boolean(url && (url.startsWith('redis://') || url.startsWith('rediss://')));

// Minimal shared surface actually used by this app.
// Both ioredis and @upstash/redis implement an async `get`.
interface RedisLike {
  get: (key: string) => Promise<unknown>;
}

const createRedisClient = (): RedisLike | undefined => {
  const kvUrl = process.env.KV_URL;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;

  // Local / self-hosted TCP Redis (redis:// or rediss://) → ioredis
  if (isLocalRedisUrl(kvUrl)) {
    const client = new IoRedis(kvUrl!, {
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
  }

  // Upstash HTTP Redis (https://...) → @upstash/redis
  if (kvUrl || upstashUrl) {
    return UpstashRedis.fromEnv();
  }

  // Fallback: custom REST Redis credentials
  if (
    process.env.EXIF_KV_REST_API_URL &&
    process.env.EXIF_KV_REST_API_TOKEN
  ) {
    return new UpstashRedis({
      url: process.env.EXIF_KV_REST_API_URL,
      token: process.env.EXIF_KV_REST_API_TOKEN,
    });
  }

  return undefined;
};

export const redis = createRedisClient();

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
