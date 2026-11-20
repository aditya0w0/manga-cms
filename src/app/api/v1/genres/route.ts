import { NextRequest } from "next/server";
import { getPrisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const db = await getPrisma();
    const genres = await db.genre.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            mangas: {
              where: {
                manga: { deletedAt: null, publicationStatus: "PUBLISHED" },
              },
            },
          },
        },
      },
    });

    return ApiResponse.success(
      genres.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        description: g.description,
        mangaCount: g._count.mangas,
      }))
    );
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
