import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ChapterCmsService } from "@/modules/chapters/chapter-cms-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await AuthService.requireUser(req, Role.ADMIN);
    const unpublished = await ChapterCmsService.unpublishChapter(params.id, user.id);
    return ApiResponse.success(unpublished);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
