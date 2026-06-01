import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

let authRl: Ratelimit | null = null;
let analyzeRl: Ratelimit | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function getAuthRatelimit(): Ratelimit | null {
  if (authRl) return authRl;
  const redis = getRedis();
  if (!redis) return null;
  authRl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    prefix: "luukku:auth",
  });
  return authRl;
}

export function getAnalyzeRatelimit(): Ratelimit | null {
  if (analyzeRl) return analyzeRl;
  const redis = getRedis();
  if (!redis) return null;
  analyzeRl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "luukku:analyze",
  });
  return analyzeRl;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
