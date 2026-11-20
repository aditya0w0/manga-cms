import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { AuthService } from "@/modules/auth/auth-service";
import { UploadPipelineService } from "@/modules/upload-pipeline/upload-pipeline";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";

const ConfirmedChapterItemSchema = z.object({
  sourceKey: z.string(),
  chapterNumber: z.number(),
  volume: z.number().optional(),
  title: z.string().optional(),
  files: z.array(z.string()),
});

const BatchUploadPayloadSchema = z.object({
  conflictStrategy: z.enum(["SKIP", "OVERWRITE"]).default("SKIP"),
  language: z.string().default("en"),
  chapters: z.array(ConfirmedChapterItemSchema).min(1, "At least one chapter must be specified in manifest"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let tempFilePath: string | null = null;

  try {
    const user = await AuthService.requireUser(req, Role.EDITOR);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const manifestJson = formData.get("manifest") as string | null;
    const conflictStrategyRaw = (formData.get("conflictStrategy") as string) || "SKIP";
    const languageRaw = (formData.get("language") as string) || "en";

    if (!file) {
      return ApiResponse.error("VALIDATION_ERROR", "Master archive file (.zip) is required", 400);
    }

    if (!manifestJson) {
      return ApiResponse.error("VALIDATION_ERROR", "User-confirmed chapter manifest is required", 400);
    }

    let parsedManifestRaw: unknown;
    try {
      parsedManifestRaw = JSON.parse(manifestJson);
    } catch {
      return ApiResponse.error("VALIDATION_ERROR", "Invalid manifest JSON format", 400);
    }

    const payloadResult = BatchUploadPayloadSchema.safeParse({
      conflictStrategy: conflictStrategyRaw,
      language: languageRaw,
      chapters: parsedManifestRaw,
    });

    if (!payloadResult.success) {
      return ApiResponse.error(
        "VALIDATION_ERROR",
        payloadResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
        400
      );
    }

    const { conflictStrategy, language, chapters } = payloadResult.data;

    // Stream uploaded file to a temporary file on disk to avoid keeping huge blobs in RAM
    const tempDir = path.join(os.tmpdir(), "mangacms-batch-uploads");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilename = `batch-${crypto.randomUUID()}.zip`;
    tempFilePath = path.join(tempDir, tempFilename);

    const arrayBuffer = await file.arrayBuffer();
    await fs.promises.writeFile(tempFilePath, Buffer.from(arrayBuffer));

    // Execute memory-safe chapter-by-chapter ingestion
    const report = await UploadPipelineService.ingestMultiChapterMasterArchive(
      params.id,
      tempFilePath,
      chapters,
      {
        conflictStrategy,
        actorId: user.id,
        language,
      }
    );

    return ApiResponse.success(report, 201);
  } catch (err) {
    return ApiResponse.handleException(err);
  } finally {
    // Guaranteed cleanup of temp archive from disk
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (cleanupErr) {
        console.warn(`[BatchUpload] Failed to delete temp file ${tempFilePath}:`, cleanupErr);
      }
    }
  }
}
