import { NextRequest, NextResponse } from "next/server";
import { safeFetchBuffer } from "@/lib/security/safe-fetch";
import sizeOf from "image-size";

const ALLOWED_IMAGE_TYPES = new Set(["jpg", "png", "webp", "avif", "gif"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "MangaCMS/1.0 (Universal Manga Reader; +https://github.com/mangacms)",
      Accept: "image/avif,image/webp,image/apng,image/jpeg,image/png,image/*;q=0.8",
    };

    if (targetUrl.includes("mangadex.org")) {
      fetchHeaders["Referer"] = "https://mangadex.org/";
    }

    const response = await safeFetchBuffer(targetUrl, {
      headers: fetchHeaders,
      timeoutMs: 15000,
      maxResponseSizeBytes: 15 * 1024 * 1024, // 15MB limit
      maxRedirects: 5,
    });

    if (response.status < 200 || response.status >= 300) {
      return new NextResponse(`Upstream returned ${response.status}`, { status: response.status });
    }

    // Verify magic bytes and enforce image format to prevent XSS / non-image delivery
    let detectedType: string | undefined;
    try {
      const dimensions = sizeOf(response.buffer);
      detectedType = dimensions.type;
    } catch {
      return new NextResponse("Invalid or corrupted image data", { status: 415 });
    }

    if (!detectedType || !ALLOWED_IMAGE_TYPES.has(detectedType)) {
      return new NextResponse("Unsupported image format", { status: 415 });
    }

    const mimeType = detectedType === "jpg" ? "image/jpeg" : `image/${detectedType}`;

    return new NextResponse(new Uint8Array(response.buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(response.buffer.length),
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400, immutable",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (err: any) {
    const message = err?.message || String(err);

    if (message.includes("SSRF Prevention Block")) {
      return new NextResponse(`Invalid or unsafe URL: ${message}`, { status: 403 });
    }
    if (message.includes("RESPONSE_TOO_LARGE")) {
      return new NextResponse("Image payload exceeds maximum allowable size (15MB)", { status: 413 });
    }
    if (message.includes("TIMEOUT")) {
      return new NextResponse("Upstream image request timed out", { status: 504 });
    }

    return new NextResponse(`Failed to fetch image: ${message}`, { status: 502 });
  }
}
