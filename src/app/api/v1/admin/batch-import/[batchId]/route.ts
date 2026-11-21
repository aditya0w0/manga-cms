import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { BatchQueueService } from "@/modules/upload-pipeline/batch-queue-service";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;

    const batchStatus = await BatchQueueService.getBatchStatus(params.batchId, {
      page,
      limit,
      status,
      search,
    });

    if (!batchStatus) {
      return ApiResponse.error("NOT_FOUND", `Batch not found: ${params.batchId}`, 404);
    }

    return ApiResponse.success({ batch: batchStatus });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch batch status";
    return ApiResponse.error("FETCH_FAILED", msg, 500);
  }
}
