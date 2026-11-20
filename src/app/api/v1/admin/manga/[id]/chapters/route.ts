import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ChapterCmsService } from "@/modules/chapters/chapter-cms-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await AuthService.requireUser(req, Role.EDITOR);
    const body = await req.json();

    if (body.chapterNumber === undefined || isNaN(Number(body.chapterNumber))) {
      return ApiResponse.error("VALIDATION_ERROR", "Field 'chapterNumber' (number) is required", 400);
    }

    const chapter = await ChapterCmsService.createChapter(
      {
        mangaId: params.id,
        chapterNumber: Number(body.chapterNumber),
        volumeNumber: body.volumeNumber ? Number(body.volumeNumber) : null,
        title: body.title,
        slug: body.slug,
        language: body.language,
        publicationStatus: body.publicationStatus,
      },
      user.id
    );

    return ApiResponse.success(chapter, 201);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
