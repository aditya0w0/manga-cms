import { NextRequest } from "next/server";
import { MangaCmsService } from "@/modules/manga/manga-cms-service";
import { ApiResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || searchParams.get("query") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await MangaCmsService.queryManga({
      query,
      page,
      limit,
      includeUnpublished: false,
    });

    return ApiResponse.paginated(result.items, result.meta);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
