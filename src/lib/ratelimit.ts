import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

let analyzeRl: Ratelimit | null = null;
let checkoutRl: Ratelimit | null = null;
let checkoutStatusRl: Ratelimit | null = null;
let reportRl: Ratelimit | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function getAnalyzeRatelimit(): Ratelimit | null {
  if (analyzeRl) return analyzeRl;
  const redis = getRedis();
  if (!redis) return null;
  analyzeRl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "luukku:analyze",
  });
  return analyzeRl;
}

export function getCheckoutRatelimit(): Ratelimit | null {
  if (checkoutRl) return checkoutRl;
  const redis = getRedis();
  if (!redis) return null;
  checkoutRl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "luukku:checkout",
  });
  return checkoutRl;
}

export function getCheckoutStatusRatelimit(): Ratelimit | null {
  if (checkoutStatusRl) return checkoutStatusRl;
  const redis = getRedis();
  if (!redis) return null;
  checkoutStatusRl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "luukku:checkout-status",
  });
  return checkoutStatusRl;
}

export function getReportRatelimit(): Ratelimit | null {
  if (reportRl) return reportRl;
  const redis = getRedis();
  if (!redis) return null;
  reportRl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "luukku:report",
  });
  return reportRl;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
