import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { MangaCmsService } from "@/modules/manga/manga-cms-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await AuthService.requireUser(req, Role.EDITOR);
    const body = await req.json();
    const updated = await MangaCmsService.updateManga(params.id, body, user.id);
    return ApiResponse.success(updated);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await AuthService.requireUser(req, Role.ADMIN);
    await MangaCmsService.deleteManga(params.id, user.id);
    return ApiResponse.success({ id: params.id, deleted: true });
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
