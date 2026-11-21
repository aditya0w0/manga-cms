import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limiter";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Only apply rate limiting to API routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Health check endpoint is bypassed for container / load balancer probes
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  const clientIp = getClientIp(req);
  const result = checkRateLimit(clientIp, pathname);

  if (!result.allowed) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: result.isQuarantined
            ? "Your IP has been temporarily throttled due to excessive traffic. Please try again later."
            : "Too many requests. Please slow down and try again.",
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(result.retryAfterSeconds),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetMs / 1000)));

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
