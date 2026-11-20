import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/auth";
import { recordReadingProgress } from "@/modules/library/library-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    // Allow guest reading progress tracking without error
    if (!user) {
      return NextResponse.json({ success: true, guest: true });
    }

    const body = await req.json();
    const { mangaId, chapterId, pageNumber = 1, percentRead = 0, isCompleted = false } = body;

    if (!mangaId || !chapterId) {
      return NextResponse.json({ error: "mangaId and chapterId are required" }, { status: 400 });
    }

    const progress = await recordReadingProgress(
      user.id,
      mangaId,
      chapterId,
      Number(pageNumber),
      Number(percentRead),
      Boolean(isCompleted)
    );

    return NextResponse.json({ success: true, progress });
  } catch (err: any) {
    console.error("Record progress error:", err);
    return NextResponse.json({ error: err.message || "Failed to record reading progress" }, { status: 500 });
  }
}
