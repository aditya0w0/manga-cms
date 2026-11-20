import { NextRequest } from "next/server";
import path from "path";
import { AuthService } from "@/modules/auth/auth-service";
import { MediaStorageService } from "@/modules/media/media-storage-service";
import { UploadPipelineService } from "@/modules/upload-pipeline/upload-pipeline";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);

    const formData = await req.formData();
    const chapterId = formData.get("chapterId") as string | null;
    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;

    const allFiles: File[] = [];
    if (singleFile) allFiles.push(singleFile);
    if (files.length > 0) allFiles.push(...files);

    if (allFiles.length === 0) {
      return ApiResponse.error("VALIDATION_ERROR", "No files provided in form-data", 400);
    }

    // Check if a single ZIP archive was uploaded
    const firstFile = allFiles[0];
    const isZip =
      allFiles.length === 1 &&
      (firstFile.name.endsWith(".zip") || firstFile.type === "application/zip");

    if (isZip) {
      const buffer = Buffer.from(await firstFile.arrayBuffer());

      // If chapterId is supplied, ingest directly into chapter
      if (chapterId) {
        const report = await UploadPipelineService.ingestChapterZip(chapterId, buffer);
        return ApiResponse.success(report, 201);
      }

      // Otherwise, extract and store media assets
      const { items, skipped } = UploadPipelineService.safeExtractZip(buffer);
      const stored = [];
      for (const item of items) {
        const media = await MediaStorageService.storeMedia(item.buffer, item.filename, item.mimeType);
        stored.push(media);
      }
      return ApiResponse.success(
        {
          totalUploaded: stored.length,
          skippedFiles: skipped,
          media: stored,
        },
        201
      );
    }

    // If chapterId is supplied with multiple files, ingest deterministically
    if (chapterId && allFiles.length > 0) {
      const pageItems = [];
      for (const f of allFiles) {
        pageItems.push({
          filename: f.name,
          buffer: Buffer.from(await f.arrayBuffer()),
          mimeType: f.type,
        });
      }
      const report = await UploadPipelineService.ingestChapterPages(chapterId, pageItems);
      return ApiResponse.success(report, 201);
    }

    // Regular bulk/single media upload
    const uploaded = [];
    for (const f of allFiles) {
      const buffer = Buffer.from(await f.arrayBuffer());
      const media = await MediaStorageService.storeMedia(buffer, f.name, f.type);
      uploaded.push(media);
    }

    return ApiResponse.success(
      uploaded.length === 1 ? uploaded[0] : uploaded,
      201
    );
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
