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
    const sortBy = (searchParams.get("sortBy") as any) || "recent";

    const result = await UserProfileService.getUserBookmarks(user.id, {
      page,
      limit,
      search,
      sortBy,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch bookmarks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.mangaId) {
      return NextResponse.json({ error: "mangaId is required" }, { status: 400 });
    }

    const result = await UserProfileService.toggleBookmark(user.id, body.mangaId);
    return NextResponse.json(result);
  } catch (err: any) {
    const status = err.message?.includes("MANGA_NOT_FOUND") ? 404 : 500;
    return NextResponse.json(
      { error: err.message || "Failed to toggle bookmark" },
      { status }
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
    const mangaId = searchParams.get("mangaId");
    if (!mangaId) {
      return NextResponse.json({ error: "mangaId parameter is required" }, { status: 400 });
    }

    const result = await UserProfileService.removeBookmark(user.id, mangaId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to remove bookmark" },
      { status: 500 }
    );
  }
}
