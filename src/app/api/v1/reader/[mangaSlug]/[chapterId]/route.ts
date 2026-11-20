import { NextRequest } from "next/server";
import { ChapterCmsService } from "@/modules/chapters/chapter-cms-service";
import { ApiResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { mangaSlug: string; chapterId: string } }
) {
  try {
    const manifest = await ChapterCmsService.getReaderManifest(
      params.mangaSlug,
      params.chapterId,
      false
    );

    if (!manifest) {
      return ApiResponse.error("RESOURCE_NOT_FOUND", "Reader manifest was not found", 404);
    }

    return ApiResponse.success(manifest);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
