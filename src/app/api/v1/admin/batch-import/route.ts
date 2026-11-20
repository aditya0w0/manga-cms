import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { AuthService } from "@/modules/auth/auth-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { z } from "zod";
import { createSourceReader } from "@/modules/upload-pipeline/source-reader";
import { SchematicLoader } from "@/modules/upload-pipeline/schematic-loader";
import { BatchQueueService } from "@/modules/upload-pipeline/batch-queue-service";
import { getPrisma } from "@/lib/database/prisma";

export const runtime = "nodejs";

const CreateBatchJsonSchema = z.object({
  sourceMode: z.enum(["archive", "local_dir", "storage_prefix"]).default("archive"),
  sourceRef: z.string().min(1, "sourceRef is required"),
  fallbackSlug: z.string().optional(),
  compressionPreset: z.enum(["lossless", "auto", "compact", "raw"]).default("auto"),
  conflictPolicy: z.enum(["skip_existing", "upsert_metadata", "replace_pages"]).default("skip_existing"),
  autoPublish: z.boolean().default(true),
});

/**
 * GET /api/v1/admin/batch-import
 * Lists recent batches.
 */
export async function GET(req: NextRequest) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);
    const db = await getPrisma();

    const batches = await db.importBatch.findMany({
      take: 30,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        batchId: true,
        status: true,
        sourceMode: true,
        totalComics: true,
        totalChapters: true,
        completedChapters: true,
        failedChapters: true,
        totalPages: true,
        processedPages: true,
        totalOutputBytes: true,
        createdAt: true,
        finishedAt: true,
      },
    });

    const serialized = batches.map((b) => ({
      ...b,
      totalOutputBytes: Number(b.totalOutputBytes),
    }));

    return ApiResponse.success({ batches: serialized });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to list batches";
    return ApiResponse.error("FETCH_FAILED", msg, 500);
  }
}

/**
 * POST /api/v1/admin/batch-import
 * Queues a new bulk comic ingestion batch.
 */
export async function POST(req: NextRequest) {
  let stagingFilePath: string | null = null;

  try {
    const user = await AuthService.requireUser(req, Role.EDITOR);
    const contentType = req.headers.get("content-type") || "";

    let sourceMode: "archive" | "local_dir" | "storage_prefix" = "archive";
    let sourceRef = "";
    let fallbackSlug: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      fallbackSlug = (formData.get("slug") as string) || undefined;

      if (!file) {
        return ApiResponse.error("VALIDATION_ERROR", "Archive file (.zip or .cbz) is required", 400);
      }

      // Stream to staging folder under ./storage/staging (or temp directory)
      const stagingDir = path.resolve(process.cwd(), "storage", "staging");
      if (!fs.existsSync(stagingDir)) {
        fs.mkdirSync(stagingDir, { recursive: true });
      }

      const randomId = crypto.randomBytes(8).toString("hex");
      const ext = path.extname(file.name).toLowerCase() || ".zip";
      stagingFilePath = path.join(stagingDir, `batch_upload_${randomId}${ext}`);

      const arrayBuffer = await file.arrayBuffer();
      await fs.promises.writeFile(stagingFilePath, Buffer.from(arrayBuffer));

      sourceMode = "archive";
      sourceRef = stagingFilePath;
    } else {
      const body = await req.json();
      const parsed = CreateBatchJsonSchema.safeParse(body);
      if (!parsed.success) {
        return ApiResponse.error("VALIDATION_ERROR", parsed.error.message, 400);
      }

      sourceMode = parsed.data.sourceMode;
      sourceRef = parsed.data.sourceRef;
      fallbackSlug = parsed.data.fallbackSlug;

      if (sourceMode === "local_dir" && process.env.ALLOW_LOCAL_DIR_INGEST !== "true") {
        return ApiResponse.error(
          "FORBIDDEN",
          "Local directory ingestion is disabled. Set ALLOW_LOCAL_DIR_INGEST=true to enable.",
          403
        );
      }
    }

    const reader = createSourceReader({
      sourceMode,
      sourceRef,
    });

    const graph = await SchematicLoader.loadBatchGraph(reader, {
      fallbackSlug,
    });

    await reader.close();

    if (graph.errors.length > 0) {
      return ApiResponse.error("INVALID_SCHEMATIC", graph.errors.join("; "), 400);
    }

    const result = await BatchQueueService.createBatchJobs(graph, sourceRef, user.id);

    return ApiResponse.success(
      {
        batchId: result.batchId,
        status: "QUEUED",
        totalComics: result.totalComics,
        totalChapters: result.totalChapters,
        warnings: graph.warnings,
      },
      202
    );
  } catch (err: unknown) {
    // If failed to create jobs, clean up staging file
    if (stagingFilePath && fs.existsSync(stagingFilePath)) {
      try {
        await fs.promises.unlink(stagingFilePath);
      } catch {}
    }

    const msg = err instanceof Error ? err.message : "Failed to queue batch";
    return ApiResponse.error("QUEUE_FAILED", msg, 500);
  }
}
