import { NextRequest } from "next/server";
import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";
import { ApiResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const db = await getPrisma();
    const manga = await db.manga.findFirst({
      where: { slug: params.slug, deletedAt: null, publicationStatus: PublicationStatus.PUBLISHED },
      select: { id: true, title: true, slug: true },
    });

    if (!manga) {
      return ApiResponse.error("RESOURCE_NOT_FOUND", `Manga with slug "${params.slug}" was not found`, 404);
    }

    const { searchParams } = new URL(req.url);
    const language = searchParams.get("language") || undefined;
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "asc";

    const chapters = await db.chapter.findMany({
      where: {
        mangaId: manga.id,
        publicationStatus: PublicationStatus.PUBLISHED,
        ...(language ? { language: language.toLowerCase() } : {}),
      },
      orderBy: { chapterNumber: sortOrder },
      select: {
        id: true,
        chapterNumber: true,
        volumeNumber: true,
        title: true,
        slug: true,
        language: true,
        publishedAt: true,
        createdAt: true,
        _count: { select: { pages: true } },
      },
    });

    return ApiResponse.success({
      manga,
      totalChapters: chapters.length,
      chapters,
    });
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
