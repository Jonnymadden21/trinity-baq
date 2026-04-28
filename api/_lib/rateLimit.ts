import { Redis } from "@upstash/redis";
import { env } from "./env";

interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

let cachedClient: RedisLike | null | undefined;

export function getRateLimitClient(): RedisLike | null {
  if (cachedClient !== undefined) return cachedClient;
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    cachedClient = null;
    return null;
  }
  cachedClient = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return cachedClient;
}

export async function checkRateLimit(
  client: RedisLike | null,
  ip: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  if (!client) return { allowed: true, remaining: limit };
  const key = `ratelimit:quotes:${ip}`;
  try {
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, windowSeconds);
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining };
  } catch (err) {
    console.error("Rate limit error (failing open):", err);
    return { allowed: true, remaining: limit };
  }
}
