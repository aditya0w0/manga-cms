import { NextResponse } from "next/server";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiResponse {
  /**
   * Successful response with single item or non-paginated data.
   */
  static success<T>(data: T, status = 200, meta: any = null) {
    return NextResponse.json(
      {
        success: true,
        data,
        meta,
      },
      { status }
    );
  }

  /**
   * Successful response with paginated collection.
   */
  static paginated<T>(data: T[], meta: PaginationMeta, status = 200) {
    return NextResponse.json(
      {
        success: true,
        data,
        meta: {
          page: meta.page,
          limit: meta.limit,
          total: meta.total,
          total_pages: meta.totalPages,
        },
      },
      { status }
    );
  }

  /**
   * Uniform error response.
   */
  static error(code: string, message: string, status = 400) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message,
        },
      },
      { status }
    );
  }

  /**
   * Catches unknown exceptions and formats safe error response without leaking stack traces.
   */
  static handleException(err: any) {
    console.error("[API Error]", err);
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("UNAUTHORIZED")) {
      return this.error("UNAUTHORIZED", "Authentication required", 401);
    }
    if (msg.includes("FORBIDDEN")) {
      return this.error("FORBIDDEN", msg.replace(/^FORBIDDEN:\s*/, ""), 403);
    }
    if (msg.includes("NOT_FOUND")) {
      return this.error("RESOURCE_NOT_FOUND", msg.replace(/^RESOURCE_NOT_FOUND:\s*/, ""), 404);
    }
    if (msg.includes("DUPLICATE") || msg.includes("EXISTS")) {
      return this.error("RESOURCE_CONFLICT", msg, 409);
    }
    if (msg.includes("INVALID") || msg.includes("VALIDATION") || msg.includes("MALICIOUS") || msg.includes("BOMB")) {
      return this.error("BAD_REQUEST", msg, 400);
    }

    return this.error("INTERNAL_SERVER_ERROR", "An unexpected server error occurred", 500);
  }
}
