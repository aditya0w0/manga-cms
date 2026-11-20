import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ChapterCmsService } from "@/modules/chapters/chapter-cms-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await AuthService.requireUser(req, Role.EDITOR);
    const body = await req.json();
    const updated = await ChapterCmsService.updateChapter(
      params.id,
      {
        chapterNumber: body.chapterNumber !== undefined ? Number(body.chapterNumber) : undefined,
        volumeNumber: body.volumeNumber !== undefined ? Number(body.volumeNumber) : undefined,
        title: body.title,
        slug: body.slug,
        language: body.language,
        publicationStatus: body.publicationStatus,
      },
      user.id
    );
    return ApiResponse.success(updated);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await AuthService.requireUser(req, Role.ADMIN);
    await ChapterCmsService.deleteChapter(params.id, user.id);
    return ApiResponse.success({ id: params.id, deleted: true });
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
