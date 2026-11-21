import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/auth";
import { UserProfileService } from "@/modules/user/user-profile-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("q") || undefined;

    const result = await UserProfileService.getUserHistory(user.id, {
      page,
      limit,
      search,
    });

    return NextResponse.json({
      history: result.items,
      pagination: result.pagination,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch reading history" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const isClearAll = searchParams.get("all") === "true";
    const mangaId = searchParams.get("mangaId");

    if (isClearAll) {
      await UserProfileService.clearAllHistory(user.id);
      return NextResponse.json({ success: true, message: "History cleared successfully" });
    }

    if (!mangaId) {
      return NextResponse.json(
        { error: "Parameter 'mangaId' or 'all=true' is required" },
        { status: 400 }
      );
    }

    await UserProfileService.deleteHistoryEntry(user.id, mangaId);
    return NextResponse.json({ success: true, message: "Entry removed from history" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete history" },
      { status: 500 }
    );
  }
}
