import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ChapterCmsService } from "@/modules/chapters/chapter-cms-service";
import { getPrisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getPrisma();
    const pages = await db.chapterPage.findMany({
      where: { chapterId: params.id },
      orderBy: { pageNumber: "asc" },
      include: { image: true },
    });

    return ApiResponse.success({
      chapterId: params.id,
      totalPages: pages.length,
      pages: pages.map((p) => ({
        id: p.id,
        pageNumber: p.pageNumber,
        url: p.imageUrl,
        width: p.width || p.image?.width || null,
        height: p.height || p.image?.height || null,
        fileSize: p.fileSize || p.image?.fileSize || null,
      })),
    });
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await AuthService.requireUser(req, Role.EDITOR);
    const body = await req.json();

    if (!body.imageId) {
      return ApiResponse.error("VALIDATION_ERROR", "Field 'imageId' is required", 400);
    }

    const page = await ChapterCmsService.addPage(
      params.id,
      body.imageId,
      body.pageNumber ? Number(body.pageNumber) : undefined,
      user.id
    );

    return ApiResponse.success(page, 201);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
