import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/auth";
import { UserProfileService } from "@/modules/user/user-profile-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const bookmarks = Array.isArray(body.bookmarks) ? body.bookmarks : [];

    const result = await UserProfileService.syncBookmarks(user.id, bookmarks);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to sync bookmarks" },
      { status: 500 }
    );
  }
}
