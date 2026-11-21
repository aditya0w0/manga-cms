import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { getOrStartInProcessWorker, getInProcessWorkerStatus } from "@/workers/batch-ingest-worker";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);
    const status = getInProcessWorkerStatus();
    return ApiResponse.success({ worker: status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch worker status";
    return ApiResponse.error("WORKER_STATUS_FAILED", msg, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);
    getOrStartInProcessWorker();
    const status = getInProcessWorkerStatus();
    return ApiResponse.success({
      worker: status,
      message: "Worker active and polling queue",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to trigger worker";
    return ApiResponse.error("WORKER_TRIGGER_FAILED", msg, 500);
  }
}
