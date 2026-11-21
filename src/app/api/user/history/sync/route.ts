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
    const history = Array.isArray(body.history) ? body.history : [];

    const result = await UserProfileService.syncHistory(user.id, history);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to sync reading history" },
      { status: 500 }
    );
  }
}
