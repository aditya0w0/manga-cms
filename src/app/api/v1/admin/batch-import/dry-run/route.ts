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

export const runtime = "nodejs";

const DryRunJsonSchema = z.object({
  sourceMode: z.enum(["archive", "local_dir", "storage_prefix"]).default("archive"),
  sourceRef: z.string().min(1, "sourceRef is required"),
  fallbackSlug: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    await AuthService.requireUser(req, Role.EDITOR);

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

      const tempDir = os.tmpdir();
      const randomId = crypto.randomBytes(8).toString("hex");
      const ext = path.extname(file.name).toLowerCase() || ".zip";
      tempFilePath = path.join(tempDir, `batch_dryrun_${randomId}${ext}`);

      const arrayBuffer = await file.arrayBuffer();
      await fs.promises.writeFile(tempFilePath, Buffer.from(arrayBuffer));

      sourceMode = "archive";
      sourceRef = tempFilePath;
    } else {
      const body = await req.json();
      const parsed = DryRunJsonSchema.safeParse(body);
      if (!parsed.success) {
        return ApiResponse.error("VALIDATION_ERROR", parsed.error.message, 400);
      }
      sourceMode = parsed.data.sourceMode;
      sourceRef = parsed.data.sourceRef;
      fallbackSlug = parsed.data.fallbackSlug;
    }

    const reader = createSourceReader({
      sourceMode,
      sourceRef,
    });

    try {
      const graph = await SchematicLoader.loadBatchGraph(reader, {
        fallbackSlug,
      });

      return ApiResponse.success({
        valid: graph.errors.length === 0,
        batchId: graph.schematic.batchId,
        sourceMode: graph.schematic.sourceMode,
        compressionPreset: graph.schematic.compressionPreset,
        autoPublish: graph.schematic.autoPublish,
        defaults: graph.schematic.defaults,
        totalComics: graph.totalComics,
        totalChapters: graph.totalChapters,
        comics: graph.comics.map((c) => ({
          slug: c.slug,
          title: c.title,
          chapterCount: c.chapters.length,
          sampleChapters: c.chapters.slice(0, 5).map((ch) => ({
            chapterKey: ch.chapterKey,
            displayNumber: ch.displayNumber,
            sortKey: ch.sortKey,
            title: ch.title,
            volume: ch.volume,
            sourceType: ch.sourceType,
          })),
        })),
        warnings: graph.warnings,
        errors: graph.errors,
      });
    } finally {
      await reader.close();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal dry-run error";
    return ApiResponse.error("DRY_RUN_FAILED", message, 500);
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch {}
    }
  }
}
