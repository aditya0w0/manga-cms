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

    const status = await BatchQueueService.getBatchStatus(params.batchId);
    if (!status) {
      return ApiResponse.error("NOT_FOUND", `Batch not found: ${params.batchId}`, 404);
    }

    return ApiResponse.success({ batch: status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch batch status";
    return ApiResponse.error("FETCH_FAILED", msg, 500);
  }
}
