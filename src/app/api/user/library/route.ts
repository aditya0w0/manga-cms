import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security/auth";
import { getUserLibrary, updateLibraryEntry } from "@/modules/library/library-service";
import { LibraryStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") as LibraryStatus) || undefined;

    const items = await getUserLibrary(user.id, status);
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { mangaId, status, score, isFavorite, notes } = body;

    if (!mangaId) {
      return NextResponse.json({ error: "mangaId is required" }, { status: 400 });
    }

    const entry = await updateLibraryEntry(user.id, mangaId, {
      status,
      score: score !== undefined ? Number(score) : undefined,
      isFavorite,
      notes,
    });

    return NextResponse.json({ success: true, entry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update library" }, { status: 500 });
  }
}
