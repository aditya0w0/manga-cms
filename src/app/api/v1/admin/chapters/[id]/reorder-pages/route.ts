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
    const user = await AuthService.requireUser(req, Role.EDITOR);
    const body = await req.json();

    if (!Array.isArray(body.orders)) {
      return ApiResponse.error("VALIDATION_ERROR", "Field 'orders' must be an array of { pageId, pageNumber }", 400);
    }

    const pages = await ChapterCmsService.reorderPages(params.id, body.orders, user.id);
    return ApiResponse.success({ chapterId: params.id, pages });
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
