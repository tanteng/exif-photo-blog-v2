import { Ratelimit } from '@upstash/ratelimit';
import { redisRateLimitClient } from './redis';

export const checkRateLimitAndThrow = async ({
  identifier,
  tokens = 100,
  duration = '1h',
}: {
  identifier: string
  tokens?: number
  duration?: Parameters<typeof Ratelimit.slidingWindow>[1]
}) => {
  // @upstash/ratelimit only supports the Upstash HTTP client. When using
  // a local ioredis backend, redisRateLimitClient is undefined and rate
  // limiting is skipped (acceptable for self-hosted single-node setups).
  if (redisRateLimitClient) {
    const limiter = new Ratelimit({
      redis: redisRateLimitClient,
      limiter: Ratelimit.slidingWindow(tokens, duration),
    });
    let success = false;
    try {
      success = (await limiter.limit(identifier)).success;
    } catch (e: any) {
      const message =
        `Failed to connect to redis rate limiting store ('${identifier}')`;
      console.error(message, e);
      throw new Error(message);
    }
    if (!success) {
      const message = `'${identifier}' rate limit exceeded`;
      console.error(message);
      throw new Error(message);
    }
  }
};
