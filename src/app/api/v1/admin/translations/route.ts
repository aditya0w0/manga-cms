import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { TranslationService } from "@/modules/translation/translation-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const user = await AuthService.requireUser(req, Role.TRANSLATOR);
    const body = await req.json();
    const { action } = body;

    if (action === "UPSERT_MANGA_TRANSLATION") {
      const result = await TranslationService.upsertMangaTranslation({
        mangaId: body.mangaId,
        languageCode: body.languageCode,
        title: body.title,
        description: body.description,
      });
      return ApiResponse.success(result, 201);
    }

    if (action === "UPSERT_CHAPTER_TRANSLATION") {
      const result = await TranslationService.upsertChapterTranslation({
        chapterId: body.chapterId,
        languageCode: body.languageCode,
        translatedTitle: body.translatedTitle,
      });
      return ApiResponse.success(result, 201);
    }

    if (action === "ADVANCE_CHAPTER_STATUS") {
      // Advancing to APPROVED or PUBLISHED requires EDITOR or ADMIN
      if (body.targetStatus === "APPROVED" || body.targetStatus === "PUBLISHED") {
        await AuthService.requireUser(req, Role.EDITOR);
      }
      const result = await TranslationService.advanceChapterTranslationStatus(
        body.chapterTranslationId,
        body.targetStatus
      );
      return ApiResponse.success(result);
    }

    return ApiResponse.error("INVALID_ACTION", "Unrecognized translation action", 400);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
