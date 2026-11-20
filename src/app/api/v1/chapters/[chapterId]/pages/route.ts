import { NextRequest } from "next/server";
import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";
import { ApiResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { chapterId: string } }
) {
  try {
    const db = await getPrisma();
    const chapter = await db.chapter.findUnique({
      where: { id: params.chapterId },
      include: {
        manga: { select: { publicationStatus: true, deletedAt: true } },
      },
    });

    if (
      !chapter ||
      chapter.publicationStatus !== PublicationStatus.PUBLISHED ||
      chapter.manga.deletedAt ||
      chapter.manga.publicationStatus !== PublicationStatus.PUBLISHED
    ) {
      return ApiResponse.error("RESOURCE_NOT_FOUND", "Chapter was not found", 404);
    }

    const pages = await db.chapterPage.findMany({
      where: { chapterId: params.chapterId },
      orderBy: { pageNumber: "asc" },
      include: { image: true },
    });

    return ApiResponse.success({
      chapterId: chapter.id,
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
