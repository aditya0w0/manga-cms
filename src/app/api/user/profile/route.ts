import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/auth";
import { UserProfileService } from "@/modules/user/user-profile-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await UserProfileService.getUserProfile(user.id);
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load user profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const updated = await UserProfileService.updateUserProfile(user.id, body);
    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    const status = err.message?.includes("TAKEN") ? 409 : 400;
    return NextResponse.json(
      { error: err.message || "Failed to update profile" },
      { status }
    );
  }
}
