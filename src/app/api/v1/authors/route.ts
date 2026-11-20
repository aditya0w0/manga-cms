import { NextRequest } from "next/server";
import { getPrisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const db = await getPrisma();
    const authors = await db.author.findMany({
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
      authors.map((a) => ({
        id: a.id,
        name: a.name,
        biography: a.biography,
        mangaCount: a._count.mangas,
      }))
    );
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
