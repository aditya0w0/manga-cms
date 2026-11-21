import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { BatchQueueService } from "@/modules/upload-pipeline/batch-queue-service";
import { getOrStartInProcessWorker } from "@/workers/batch-ingest-worker";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);

    const result = await BatchQueueService.resumeBatch(params.batchId);

    // Ensure worker is actively polling the queue
    getOrStartInProcessWorker();

    return ApiResponse.success({
      batchId: params.batchId,
      resumedCount: result.resumedCount,
      status: "QUEUED",
      message: `Batch resumed. ${result.resumedCount} jobs queued from checkpoint.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to resume batch";
    return ApiResponse.error("RESUME_FAILED", msg, 500);
  }
}
