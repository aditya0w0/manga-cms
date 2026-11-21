import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { BatchQueueService } from "@/modules/upload-pipeline/batch-queue-service";
import { getOrStartInProcessWorker } from "@/workers/batch-ingest-worker";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { batchId: string; jobId: string } }
) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);

    await BatchQueueService.retryChapterJob(params.jobId);

    // Ensure worker is actively polling the queue
    getOrStartInProcessWorker();

    return ApiResponse.success({
      jobId: params.jobId,
      batchId: params.batchId,
      status: "PENDING",
      message: "Chapter job queued for retry from checkpoint",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retry chapter job";
    return ApiResponse.error("RETRY_CHAPTER_FAILED", msg, 500);
  }
}
