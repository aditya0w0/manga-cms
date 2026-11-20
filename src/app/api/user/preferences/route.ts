import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/auth";
import { getUserPreferences, saveUserPreferences } from "@/modules/library/library-service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      // Default preferences for guest
      return NextResponse.json({
        preference: {
          readingMode: "VERTICAL_SCROLL",
          readingDirection: "LTR",
          imageScaling: "FIT_WIDTH",
          backgroundColor: "DARK",
          pageGap: 12,
          preloadCount: 2,
          showPageNumbers: true,
        },
      });
    }

    const preference = await getUserPreferences(user.id);
    return NextResponse.json({ preference });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load preferences" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, guest: true });
    }

    const body = await req.json();
    const updated = await saveUserPreferences(user.id, body);
    return NextResponse.json({ success: true, preference: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save preferences" }, { status: 500 });
  }
}
