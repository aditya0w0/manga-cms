import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ReaderProgressService } from "@/modules/reader/reader-progress-service";
import { ApiResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const user = await AuthService.requireUser(req);
    const body = await req.json();

    if (!body.mangaId || !body.chapterId) {
      return ApiResponse.error("VALIDATION_ERROR", "mangaId and chapterId are required", 400);
    }

    const progress = await ReaderProgressService.updateProgress(
      user.id,
      body.mangaId,
      body.chapterId,
      body.pageNumber || 1
    );

    return ApiResponse.success(progress);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await AuthService.requireUser(req);
    const { searchParams } = new URL(req.url);
    const mangaId = searchParams.get("mangaId");

    if (!mangaId) {
      return ApiResponse.error("VALIDATION_ERROR", "Query parameter 'mangaId' is required", 400);
    }

    const progress = await ReaderProgressService.getProgress(user.id, mangaId);
    return ApiResponse.success(progress);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
