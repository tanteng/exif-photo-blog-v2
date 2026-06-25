import { Redis as UpstashRedis } from '@upstash/redis';
import Ioredis from 'ioredis';

const KEY_TEST = 'test';

const isLocalRedis = (url?: string) =>
  url?.startsWith('redis://') || url?.startsWith('rediss://');

const getRedisClient = (): Ioredis | UpstashRedis | undefined => {
  const kvUrl = process.env.KV_URL;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;

  // Local TCP Redis → ioredis
  if (isLocalRedis(kvUrl)) {
    return new Ioredis(kvUrl!);
  }

  // Upstash HTTP Redis → @upstash/redis
  if (kvUrl || upstashUrl) {
    return UpstashRedis.fromEnv();
  }

  // Fallback: custom REST Redis
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

export const redis = getRedisClient() as
  | Ioredis
  | UpstashRedis
  | undefined;

export const warmRedisConnection = () => {
  if (redis) { redis.get(KEY_TEST); }
};

export const testRedisConnection = () => redis
  ? redis.get(KEY_TEST)
  : Promise.reject(false) as Promise<any>;
