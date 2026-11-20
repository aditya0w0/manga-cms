import { NextRequest } from "next/server";
import { MangaCmsService } from "@/modules/manga/manga-cms-service";
import { ApiResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const query = searchParams.get("query") || searchParams.get("search") || undefined;
    const genre = searchParams.get("genre") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const author = searchParams.get("author") || undefined;
    const publicationStatus = (searchParams.get("publicationStatus") as any) || undefined;
    const contentRating = (searchParams.get("contentRating") as any) || undefined;
    const language = searchParams.get("language") || undefined;
    const sortBy = (searchParams.get("sortBy") as any) || "latest";
    const sortOrder = (searchParams.get("sortOrder") as any) || "desc";

    const result = await MangaCmsService.queryManga({
      page,
      limit,
      query,
      genre,
      tag,
      author,
      publicationStatus,
      contentRating,
      language,
      sortBy,
      sortOrder,
      includeUnpublished: false,
    });

    return ApiResponse.paginated(result.items, result.meta);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
