import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { WdTaggerService } from "@/modules/content-policy/wd-tagger-service";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    if (!body.imageUrl || typeof body.imageUrl !== "string") {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    const start = Date.now();
    const result = await WdTaggerService.classifyImage(body.imageUrl.trim());
    const totalLatencyMs = Date.now() - start;

    return NextResponse.json({
      success: true,
      totalLatencyMs,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to classify image" },
      { status: 500 }
    );
  }
}
