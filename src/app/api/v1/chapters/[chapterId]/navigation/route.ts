import { NextRequest } from "next/server";
import { ChapterCmsService } from "@/modules/chapters/chapter-cms-service";
import { ApiResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { chapterId: string } }
) {
  try {
    const navigation = await ChapterCmsService.getChapterNavigation(params.chapterId, false);
    if (!navigation) {
      return ApiResponse.error("RESOURCE_NOT_FOUND", "Chapter navigation was not found", 404);
    }
    return ApiResponse.success(navigation);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
