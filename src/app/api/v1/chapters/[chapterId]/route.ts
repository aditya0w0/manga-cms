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
        manga: {
          select: { id: true, title: true, slug: true, publicationStatus: true, deletedAt: true },
        },
        _count: { select: { pages: true } },
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

    return ApiResponse.success(chapter);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
