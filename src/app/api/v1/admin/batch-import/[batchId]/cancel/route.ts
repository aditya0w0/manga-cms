import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { BatchQueueService } from "@/modules/upload-pipeline/batch-queue-service";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);

    await BatchQueueService.cancelBatch(params.batchId);
    return ApiResponse.success({
      batchId: params.batchId,
      status: "CANCELLED",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to cancel batch";
    return ApiResponse.error("CANCEL_FAILED", msg, 500);
  }
}
