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
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Both currentPassword and newPassword are required" },
        { status: 400 }
      );
    }

    await UserProfileService.changeUserPassword(user.id, currentPassword, newPassword);
    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    const status = err.message?.includes("INVALID_PASSWORD") ? 403 : 400;
    return NextResponse.json(
      { error: err.message || "Failed to update password" },
      { status }
    );
  }
}
