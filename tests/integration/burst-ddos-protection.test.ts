import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  rateLimiter,
  checkRateLimit,
  getClientIp,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limiter";
import { middleware } from "@/middleware";

describe("Anti-DDoS & Burst Traffic Protection Simulation", () => {
  beforeEach(() => {
    rateLimiter.reset();
  });

  describe("IP Extraction & Normalization", () => {
    it("extracts client IP from Cloudflare header", () => {
      const req = new NextRequest("http://localhost:3001/api/v1/manga", {
        headers: { "cf-connecting-ip": "198.51.100.1" },
      });
      expect(getClientIp(req)).toBe("198.51.100.1");
    });

    it("extracts client IP from X-Forwarded-For header", () => {
      const req = new NextRequest("http://localhost:3001/api/v1/manga", {
        headers: { "x-forwarded-for": "203.0.113.195, 10.0.0.1" },
      });
      expect(getClientIp(req)).toBe("203.0.113.195");
    });

    it("extracts client IP from X-Real-IP header", () => {
      const req = new NextRequest("http://localhost:3001/api/v1/manga", {
        headers: { "x-real-ip": "192.0.2.45" },
      });
      expect(getClientIp(req)).toBe("192.0.2.45");
    });
  });

  describe("Auth Endpoint Burst & Brute-Force Defense", () => {
    const attackerIp = "185.220.101.5";
    const authPath = "/api/auth/login";

    it("allows requests up to the strict authentication threshold", () => {
      const limit = RATE_LIMIT_POLICIES.AUTH.maxRequests;
      const now = Date.now();

      for (let i = 1; i <= limit; i++) {
        const result = checkRateLimit(attackerIp, authPath, now + i * 10);
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(limit);
        expect(result.remaining).toBe(limit - i);
      }
    });

    it("rejects burst attempts exceeding the threshold with HTTP 429", () => {
      const limit = RATE_LIMIT_POLICIES.AUTH.maxRequests;
      const now = Date.now();

      // Exhaust limit
      for (let i = 0; i < limit; i++) {
        checkRateLimit(attackerIp, authPath, now + i * 10);
      }

      // Next request must be blocked
      const blocked = checkRateLimit(attackerIp, authPath, now + 1000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.isQuarantined).toBe(false);
    });

    it("places abusive volumetric DDoS burst into penalty box quarantine", () => {
      const limit = RATE_LIMIT_POLICIES.AUTH.maxRequests;
      const now = Date.now();

      // Flood 2x threshold rapidly
      for (let i = 0; i < limit * 2 + 2; i++) {
        checkRateLimit(attackerIp, authPath, now + i * 5);
      }

      const quarantined = checkRateLimit(attackerIp, authPath, now + 5000);
      expect(quarantined.allowed).toBe(false);
      expect(quarantined.isQuarantined).toBe(true);
      expect(quarantined.retryAfterSeconds).toBeGreaterThan(30);
    });
  });

  describe("Resource-Heavy Endpoints Burst Defense", () => {
    const userIp = "192.0.2.88";
    const proxyPath = "/api/image-proxy?url=https://example.com/cover.png";

    it("enforces moderate 60 req/min limit on image-proxy and search", () => {
      const limit = RATE_LIMIT_POLICIES.HEAVY.maxRequests;
      const now = Date.now();

      for (let i = 0; i < limit; i++) {
        const res = checkRateLimit(userIp, proxyPath, now + i * 10);
        expect(res.allowed).toBe(true);
      }

      const excess = checkRateLimit(userIp, proxyPath, now + 1000);
      expect(excess.allowed).toBe(false);
      expect(excess.limit).toBe(60);
    });
  });

  describe("IP Isolation (No Cross-Tenant Collateral Damage)", () => {
    it("blocking an abusive IP does not affect legitimate traffic from another IP", () => {
      const badIp = "198.51.100.99";
      const goodIp = "203.0.113.88";
      const path = "/api/auth/login";
      const now = Date.now();

      // Exhaust bad IP
      for (let i = 0; i < 20; i++) {
        checkRateLimit(badIp, path, now);
      }

      expect(checkRateLimit(badIp, path, now).allowed).toBe(false);

      // Good IP should be completely unaffected
      const goodRes = checkRateLimit(goodIp, path, now);
      expect(goodRes.allowed).toBe(true);
      expect(goodRes.remaining).toBe(RATE_LIMIT_POLICIES.AUTH.maxRequests - 1);
    });
  });

  describe("Next.js Edge/Node Middleware Integration", () => {
    it("bypasses health probe endpoint without consuming rate budget", () => {
      const req = new NextRequest("http://localhost:3001/api/health", {
        headers: { "x-real-ip": "127.0.0.1" },
      });

      const res = middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
    });

    it("attaches rate limit headers to legitimate API requests", () => {
      const req = new NextRequest("http://localhost:3001/api/v1/manga", {
        headers: { "x-real-ip": "198.51.100.77" },
      });

      const res = middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBe("200");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("199");
      expect(res.headers.get("X-RateLimit-Reset")).toBeDefined();
    });

    it("returns HTTP 429 JSON response with Retry-After when burst exceeds limit", () => {
      const ip = "198.51.100.123";
      const makeReq = () =>
        new NextRequest("http://localhost:3001/api/auth/login", {
          method: "POST",
          headers: { "x-real-ip": ip },
        });

      // Send 12 requests
      for (let i = 0; i < 12; i++) {
        middleware(makeReq());
      }

      // 13th request triggers 429
      const throttledRes = middleware(makeReq());
      expect(throttledRes.status).toBe(429);
      expect(throttledRes.headers.get("Retry-After")).toBeDefined();
      expect(throttledRes.headers.get("X-RateLimit-Remaining")).toBe("0");
    });
  });
});
