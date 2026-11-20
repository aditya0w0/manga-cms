import { NextRequest } from "next/server";
import { getPrisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const db = await getPrisma();
    const tags = await db.tag.findMany({
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
      tags.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        mangaCount: t._count.mangas,
      }))
    );
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
