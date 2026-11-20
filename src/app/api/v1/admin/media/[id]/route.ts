import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { MediaStorageService } from "@/modules/media/media-storage-service";
import { getPrisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);
    const db = await getPrisma();
    const media = await db.media.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { pages: true, coverForManga: true } },
      },
    });

    if (!media) {
      return ApiResponse.error("RESOURCE_NOT_FOUND", "Media asset was not found", 404);
    }

    return ApiResponse.success({
      ...media,
      url: MediaStorageService.getMediaUrl(media.storageKey),
    });
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await AuthService.requireUser(req, Role.ADMIN);
    await MediaStorageService.deleteMedia(params.id);
    return ApiResponse.success({ id: params.id, deleted: true });
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
