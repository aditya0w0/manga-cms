import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { MediaStorageService } from "@/modules/media/media-storage-service";

export async function GET(
  req: NextRequest,
  { params }: { params: { storageKey: string[] } }
) {
  try {
    const rawKey = params.storageKey.join("/");
    console.log("[Media Route Debug]", { params, rawKey });
    const resolved = await MediaStorageService.getMediaByStorageKey(rawKey);
    console.log("[Media Route Debug Result]", { resolved: !!resolved, filePath: resolved?.filePath });

    if (!resolved || !fs.existsSync(resolved.filePath)) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Media file not found" } },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.promises.readFile(resolved.filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": resolved.media.mimeType || "image/jpeg",
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (err) {
    console.error("[Media Serve Error]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to read media" } },
      { status: 500 }
    );
  }
}
