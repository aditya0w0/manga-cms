import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { UploadPipelineService } from "@/modules/upload-pipeline/upload-pipeline";
import { ApiResponse } from "@/lib/api-response";
import { Role, PublicationStatus } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";

const BatchItemMetadataSchema = z.object({
  chapterNumber: z.number({ message: "chapterNumber is required" }),
  volume: z.number().optional(),
  title: z.string().optional(),
  conflictStrategy: z.enum(["SKIP", "OVERWRITE"]).default("SKIP"),
  language: z.string().default("en"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await AuthService.requireUser(req, Role.EDITOR);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const chapterNumberStr = formData.get("chapterNumber") as string | null;
    const volumeStr = formData.get("volume") as string | null;
    const title = (formData.get("title") as string) || undefined;
    const conflictStrategy = (formData.get("conflictStrategy") as "SKIP" | "OVERWRITE") || "SKIP";
    const language = (formData.get("language") as string) || "en";

    if (!file) {
      return ApiResponse.error("VALIDATION_ERROR", "Archive file (.zip or .cbz) is required", 400);
    }

    if (!chapterNumberStr || isNaN(parseFloat(chapterNumberStr))) {
      return ApiResponse.error("VALIDATION_ERROR", "Valid chapterNumber is required", 400);
    }

    const chapterNumber = parseFloat(chapterNumberStr);
    const volume = volumeStr ? parseFloat(volumeStr) : undefined;

    const validated = BatchItemMetadataSchema.safeParse({
      chapterNumber,
      volume,
      title,
      conflictStrategy,
      language,
    });

    if (!validated.success) {
      return ApiResponse.error(
        "VALIDATION_ERROR",
        validated.error.issues.map((i) => i.message).join(", "),
        400
      );
    }

    // 1. Find or create the chapter record
    const { chapter, isNew } = await UploadPipelineService.findOrCreateChapter(
      params.id,
      validated.data.chapterNumber,
      {
        volumeNumber: validated.data.volume,
        title: validated.data.title,
        language: validated.data.language,
        publicationStatus: PublicationStatus.PUBLISHED,
        createdById: user.id,
      }
    );

    // 2. Ingest archive pages into the chapter
    const buffer = Buffer.from(await file.arrayBuffer());
    const report = await UploadPipelineService.ingestChapterZip(chapter.id, buffer, {
      conflictStrategy: validated.data.conflictStrategy,
    });

    return ApiResponse.success(
      {
        chapterId: chapter.id,
        chapterNumber: chapter.chapterNumber,
        isNew,
        skipped: report.skipped,
        totalPages: report.totalPages,
        duplicatesFound: report.duplicatesFound,
      },
      201
    );
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
