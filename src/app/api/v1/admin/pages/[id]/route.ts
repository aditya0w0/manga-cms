import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ChapterCmsService } from "@/modules/chapters/chapter-cms-service";
import { getPrisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);
    const body = await req.json();
    const db = await getPrisma();

    const existing = await db.chapterPage.findUnique({ where: { id: params.id } });
    if (!existing) throw new Error("PAGE_NOT_FOUND");

    const updated = await db.chapterPage.update({
      where: { id: params.id },
      data: {
        pageNumber: body.pageNumber !== undefined ? Number(body.pageNumber) : undefined,
        imageId: body.imageId !== undefined ? body.imageId : undefined,
      },
    });

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
    const user = await AuthService.requireUser(req, Role.EDITOR);
    await ChapterCmsService.deletePage(params.id, user.id);
    return ApiResponse.success({ id: params.id, deleted: true });
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
