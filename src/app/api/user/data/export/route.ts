import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/auth";
import { UserProfileService } from "@/modules/user/user-profile-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await UserProfileService.exportUserData(user.id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="mangacms_backup_${user.username}_${Date.now()}.json"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to export user data" },
      { status: 500 }
    );
  }
}
