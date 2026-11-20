import { NextRequest } from "next/server";
import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";
import { MediaStorageService } from "@/modules/media/media-storage-service";
import { ApiResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const db = await getPrisma();
    const where = {
      deletedAt: null,
      publicationStatus: PublicationStatus.PUBLISHED,
    };

    const [featured, trending, latest] = await Promise.all([
      db.manga.findMany({
        where: { ...where, isFeatured: true },
        take: 6,
        orderBy: { updatedAt: "desc" },
        include: { coverImage: true },
      }),
      db.manga.findMany({
        where,
        take: 10,
        orderBy: { viewCount: "desc" },
        include: { coverImage: true },
      }),
      db.manga.findMany({
        where,
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { coverImage: true },
      }),
    ]);

    const format = (list: any[]) =>
      list.map((m) => ({
        ...m,
        coverUrl: m.coverImage
          ? MediaStorageService.getMediaUrl(m.coverImage.storageKey)
          : m.coverUrl,
      }));

    return ApiResponse.success({
      featured: format(featured),
      trending: format(trending),
      latest: format(latest),
    });
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
