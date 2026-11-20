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
      select: {
        id: true,
        authors: {
          include: { author: true },
        },
      },
    });

    if (!manga) {
      return ApiResponse.error("RESOURCE_NOT_FOUND", `Manga with slug "${params.slug}" was not found`, 404);
    }

    return ApiResponse.success(
      manga.authors.map((a) => ({
        ...a.author,
        contributionRole: a.contributionRole,
      }))
    );
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
