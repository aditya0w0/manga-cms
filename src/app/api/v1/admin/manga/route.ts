import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { MangaCmsService } from "@/modules/manga/manga-cms-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const user = await AuthService.requireUser(req, Role.EDITOR);
    const body = await req.json();

    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return ApiResponse.error("VALIDATION_ERROR", "Field 'title' is required", 400);
    }

    const manga = await MangaCmsService.createManga(body, user.id);
    return ApiResponse.success(manga, 201);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
