import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ReaderProgressService } from "@/modules/reader/reader-progress-service";
import { ApiResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const user = await AuthService.requireUser(req);
    const body = await req.json();

    if (!body.mangaId) {
      return ApiResponse.error("VALIDATION_ERROR", "Field 'mangaId' is required", 400);
    }

    const result = await ReaderProgressService.toggleBookmark(user.id, body.mangaId);
    return ApiResponse.success(result);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await AuthService.requireUser(req);
    const bookmarks = await ReaderProgressService.getUserBookmarks(user.id);
    return ApiResponse.success(bookmarks);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
