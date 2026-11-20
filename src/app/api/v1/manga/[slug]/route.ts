import { NextRequest } from "next/server";
import { MangaCmsService } from "@/modules/manga/manga-cms-service";
import { ApiResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const manga = await MangaCmsService.getMangaBySlug(params.slug, false);
    if (!manga) {
      return ApiResponse.error("RESOURCE_NOT_FOUND", `Manga with slug "${params.slug}" was not found`, 404);
    }
    return ApiResponse.success(manga);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
