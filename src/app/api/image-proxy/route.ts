import { NextRequest, NextResponse } from "next/server";
import { validateSafeUrl } from "@/lib/security/safe-fetch";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Security check against SSRF
  const validation = await validateSafeUrl(targetUrl);
  if (!validation.safe) {
    return new NextResponse(`Invalid or unsafe URL: ${validation.error}`, { status: 403 });
  }

  try {
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "MangaCMS/1.0 (Universal Manga Reader; +https://github.com/mangacms)",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    };

    if (targetUrl.includes("mangadex.org")) {
      fetchHeaders["Referer"] = "https://mangadex.org/";
    }

    const upstream = await fetch(targetUrl, {
      headers: fetchHeaders,
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      return new NextResponse(`Upstream returned ${upstream.status}`, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return new NextResponse(`Failed to fetch image: ${err.message}`, { status: 502 });
  }
}
