import { NextRequest } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { MangaCmsService } from "@/modules/manga/manga-cms-service";
import { MediaStorageService } from "@/modules/media/media-storage-service";
import { ApiResponse } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await AuthService.requireUser(req, Role.EDITOR);

    // Accept either multipart/form-data with file or JSON with mediaId
    const contentType = req.headers.get("content-type") || "";
    let mediaId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return ApiResponse.error("VALIDATION_ERROR", "No file uploaded in form-data", 400);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const media = await MediaStorageService.storeMedia(buffer, file.name, file.type);
      mediaId = media.id;
    } else {
      const body = await req.json();
      mediaId = body.mediaId;
    }

    if (!mediaId) {
      return ApiResponse.error("VALIDATION_ERROR", "mediaId is required", 400);
    }

    const updated = await MangaCmsService.setMangaCover(params.id, mediaId, user.id);
    return ApiResponse.success(updated);
  } catch (err) {
    return ApiResponse.handleException(err);
  }
}
