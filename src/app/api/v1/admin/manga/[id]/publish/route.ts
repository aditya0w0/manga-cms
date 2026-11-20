import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { getPrisma } from "@/lib/database/prisma";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);
    const db = await getPrisma();

    const manga = await db.manga.findFirst({
      where: {
        OR: [{ id: params.id }, { slug: params.id }],
      },
    });

    if (!manga) {
      return ApiResponse.error("NOT_FOUND", `Manga not found: ${params.id}`, 404);
    }

    const updated = await db.manga.update({
      where: { id: manga.id },
      data: {
        publicationStatus: "PUBLISHED",
      },
    });

    return ApiResponse.success({
      mangaId: updated.id,
      slug: updated.slug,
      publicationStatus: updated.publicationStatus,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to publish manga";
    return ApiResponse.error("PUBLISH_FAILED", msg, 500);
  }
}
