import { NextRequest } from "next/server";

export interface RateLimitPolicy {
  windowMs: number;
  maxRequests: number;
  penaltyMs: number; // Duration to quarantine IP if rate is aggressively exceeded (e.g. 2x threshold)
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSeconds: number;
  isQuarantined: boolean;
}

interface IpTracker {
  timestamps: number[];
  quarantinedUntil: number;
}

export const RATE_LIMIT_POLICIES = {
  // Sensitive endpoints susceptible to brute-force or high CPU hashing (Argon2id)
  AUTH: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 12,      // Max 12 requests per minute
    penaltyMs: 120 * 1000, // 2 minutes penalty box
  },
  // Resource-heavy endpoints (image proxy, search queries, upload endpoints)
  HEAVY: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    penaltyMs: 60 * 1000,
  },
  // Default general API threshold
  STANDARD: {
    windowMs: 60 * 1000,
    maxRequests: 200,
    penaltyMs: 60 * 1000,
  },
};

class MemoryRateLimiter {
  private trackers: Map<string, IpTracker> = new Map();
  private lastPruneTime: number = Date.now();
  private readonly PRUNE_INTERVAL_MS = 60 * 1000; // Prune every 1 minute
  private readonly MAX_TRACKER_ENTRIES = 50_000;

  /**
   * Resolves the matching policy for an incoming request pathname.
   */
  getPolicyForPath(pathname: string): RateLimitPolicy {
    if (
      pathname.startsWith("/api/auth/login") ||
      pathname.startsWith("/api/auth/register")
    ) {
      return RATE_LIMIT_POLICIES.AUTH;
    }

    if (
      pathname.startsWith("/api/image-proxy") ||
      pathname.startsWith("/api/v1/search") ||
      pathname.includes("/upload-zip") ||
      pathname.startsWith("/api/v1/admin/batch-import")
    ) {
      return RATE_LIMIT_POLICIES.HEAVY;
    }

    return RATE_LIMIT_POLICIES.STANDARD;
  }

  /**
   * Assesses and records an incoming request from a given client IP.
   */
  check(ip: string, pathname: string, now: number = Date.now()): RateLimitResult {
    this.maybePrune(now);

    const policy = this.getPolicyForPath(pathname);
    // Key by policy category and IP so heavy proxy usage doesn't starve standard browsing
    const categoryKey = pathname.startsWith("/api/auth/")
      ? "auth"
      : pathname.startsWith("/api/image-proxy") || pathname.startsWith("/api/v1/search")
      ? "heavy"
      : "standard";
    const key = `${categoryKey}:${ip}`;

    let tracker = this.trackers.get(key);
    if (!tracker) {
      tracker = { timestamps: [], quarantinedUntil: 0 };
      this.trackers.set(key, tracker);
    }

    // Check if IP is currently quarantined in penalty box
    if (tracker.quarantinedUntil > now) {
      const retryAfter = Math.ceil((tracker.quarantinedUntil - now) / 1000);
      return {
        allowed: false,
        limit: policy.maxRequests,
        remaining: 0,
        resetMs: tracker.quarantinedUntil,
        retryAfterSeconds: Math.max(1, retryAfter),
        isQuarantined: true,
      };
    }

    // Prune timestamps outside the rolling window
    const windowStart = now - policy.windowMs;
    tracker.timestamps = tracker.timestamps.filter((ts) => ts > windowStart);

    const currentCount = tracker.timestamps.length;

    // Check for aggressive bursting (e.g. 2x the allowable threshold) -> quarantine
    if (currentCount >= policy.maxRequests * 2) {
      tracker.quarantinedUntil = now + policy.penaltyMs;
      const retryAfter = Math.ceil(policy.penaltyMs / 1000);
      return {
        allowed: false,
        limit: policy.maxRequests,
        remaining: 0,
        resetMs: tracker.quarantinedUntil,
        retryAfterSeconds: retryAfter,
        isQuarantined: true,
      };
    }

    if (currentCount >= policy.maxRequests) {
      const oldestTimestamp = tracker.timestamps[0] || now;
      const resetMs = oldestTimestamp + policy.windowMs;
      const retryAfter = Math.ceil((resetMs - now) / 1000);

      // Record this rejection attempt for quarantine calculations
      tracker.timestamps.push(now);

      return {
        allowed: false,
        limit: policy.maxRequests,
        remaining: 0,
        resetMs,
        retryAfterSeconds: Math.max(1, retryAfter),
        isQuarantined: false,
      };
    }

    // Allow request and record timestamp
    tracker.timestamps.push(now);
    const remaining = Math.max(0, policy.maxRequests - tracker.timestamps.length);
    const resetMs = (tracker.timestamps[0] || now) + policy.windowMs;
    const retryAfter = Math.max(0, Math.ceil((resetMs - now) / 1000));

    return {
      allowed: true,
      limit: policy.maxRequests,
      remaining,
      resetMs,
      retryAfterSeconds: retryAfter,
      isQuarantined: false,
    };
  }

  /**
   * Resets rate limiter memory state (useful for test suites).
   */
  reset(): void {
    this.trackers.clear();
    this.lastPruneTime = Date.now();
  }

  /**
   * Evicts expired trackers to prevent memory growth under DDoS attempts.
   */
  private maybePrune(now: number): void {
    if (
      now - this.lastPruneTime < this.PRUNE_INTERVAL_MS &&
      this.trackers.size < this.MAX_TRACKER_ENTRIES
    ) {
      return;
    }

    this.lastPruneTime = now;
    const maxWindow = 120 * 1000; // Max tracker window 2 minutes

    this.trackers.forEach((tracker, key) => {
      if (tracker.quarantinedUntil > now) {
        return;
      }
      const hasRecent = tracker.timestamps.some((ts: number) => ts > now - maxWindow);
      if (!hasRecent) {
        this.trackers.delete(key);
      }
    });
  }
}

export const rateLimiter = new MemoryRateLimiter();

/**
 * Extracts normalized client IP address from Next.js request headers.
 */
export function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers;

  // Cloudflare header
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Standard reverse proxy header (takes the left-most client IP)
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",");
    const clientIp = ips[0]?.trim();
    if (clientIp) return clientIp;
  }

  // Nginx real IP header
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

/**
 * Convenience helper to verify rate limit status for a request.
 */
export function checkRateLimit(
  ip: string,
  pathname: string,
  now?: number
): RateLimitResult {
  return rateLimiter.check(ip, pathname, now);
}
