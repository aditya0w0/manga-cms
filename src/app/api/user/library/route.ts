import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/auth";
import { updateLibraryEntry } from "@/modules/library/library-service";
import { getPrisma } from "@/lib/database/prisma";
import { LibraryStatus, Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const VALID_LIBRARY_STATUSES = new Set(["READING", "COMPLETED", "ON_HOLD", "PLAN_TO_READ", "DROPPED"]);
    const status = statusParam && VALID_LIBRARY_STATUSES.has(statusParam)
      ? (statusParam as LibraryStatus)
      : undefined;
    const isFavoriteOnly = statusParam === "FAVORITES";
    const search = searchParams.get("q")?.trim();

    const db = await getPrisma();
    const where: Prisma.UserLibraryWhereInput = {
      userId: user.id,
      manga: { deletedAt: null },
      ...(status ? { status } : {}),
      ...(isFavoriteOnly ? { isFavorite: true } : {}),
    };

    if (search) {
      where.manga = {
        deletedAt: null,
        title: { contains: search, mode: "insensitive" },
      };
    }

    const items = await db.userLibrary.findMany({
      where,
      include: {
        manga: {
          include: {
            genres: { include: { genre: true } },
            chapters: {
              orderBy: { chapterNumber: "desc" },
              take: 1,
              select: {
                id: true,
                chapterNumber: true,
                chapterTitle: true,
                createdAt: true,
              },
            },
            _count: { select: { chapters: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Also fetch user's last reading progress for these titles
    const mangaIds = items.map((i) => i.mangaId);
    const histories = await db.readingHistory.findMany({
      where: { userId: user.id, mangaId: { in: mangaIds } },
      include: {
        chapter: {
          select: { id: true, chapterNumber: true, chapterTitle: true },
        },
      },
    });
    const historyMap = new Map(histories.map((h) => [h.mangaId, h]));

    const enrichedItems = items.map((item) => {
      const reading = historyMap.get(item.mangaId) || null;
      const latestChapter = item.manga.chapters[0] || null;

      return {
        id: item.id,
        mangaId: item.mangaId,
        status: item.status,
        score: item.score,
        isFavorite: item.isFavorite,
        notes: item.notes,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        manga: {
          id: item.manga.id,
          title: item.manga.title,
          slug: item.manga.slug,
          coverUrl: item.manga.coverUrl,
          publicationStatus: item.manga.publicationStatus,
          contentType: item.manga.contentType,
          totalChapters: item.manga._count.chapters,
          latestChapter,
          genres: item.manga.genres.map((g) => g.genre.name),
        },
        readingProgress: reading
          ? {
              chapterId: reading.chapterId,
              chapterNumber: reading.chapter.chapterNumber,
              chapterTitle: reading.chapter.chapterTitle,
              pageNumber: reading.pageNumber,
              percentRead: reading.percentRead,
              isCompleted: reading.isCompleted,
              lastReadAt: reading.lastReadAt,
            }
          : null,
      };
    });

    return NextResponse.json({ items: enrichedItems });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { mangaId, status, score, isFavorite, notes } = body;

    if (!mangaId) {
      return NextResponse.json({ error: "mangaId is required" }, { status: 400 });
    }

    const VALID_LIBRARY_STATUSES = new Set(["READING", "COMPLETED", "ON_HOLD", "PLAN_TO_READ", "DROPPED"]);
    const safeStatus = status && VALID_LIBRARY_STATUSES.has(status) ? (status as LibraryStatus) : undefined;
    const safeScore =
      score !== undefined && score !== null && !isNaN(Number(score))
        ? Math.min(10, Math.max(0, Number(score)))
        : undefined;
    const safeNotes = typeof notes === "string" ? notes.slice(0, 2000) : undefined;

    const entry = await updateLibraryEntry(user.id, mangaId, {
      status: safeStatus,
      score: safeScore,
      isFavorite,
      notes: safeNotes,
    });

    return NextResponse.json({ success: true, entry });
  } catch (err: any) {
    const statusCode = err.message?.includes("MANGA_NOT_FOUND") ? 404 : 500;
    return NextResponse.json({ error: err.message || "Failed to update library" }, { status: statusCode });
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
      return NextResponse.json({ error: "Parameter 'mangaId' is required" }, { status: 400 });
    }

    const db = await getPrisma();
    await db.userLibrary.deleteMany({
      where: { userId: user.id, mangaId },
    });

    return NextResponse.json({ success: true, message: "Removed from library" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to remove from library" }, { status: 500 });
  }
}
