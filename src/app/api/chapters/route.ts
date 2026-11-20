import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const db = await getPrisma();

    const {
      mangaId,
      chapterNumber,
      chapterTitle,
      volume,
      language = "en",
      scanlationGroup,
      publicationStatus = PublicationStatus.PUBLISHED,
      releaseDate,
    } = body;

    if (!mangaId || chapterNumber === undefined) {
      return NextResponse.json({ error: "mangaId and chapterNumber are required" }, { status: 400 });
    }

    const chapter = await db.chapter.create({
      data: {
        mangaId,
        chapterNumber: Number(chapterNumber),
        chapterTitle,
        volume: volume ? Number(volume) : undefined,
        language,
        scanlationGroup,
        publicationStatus,
        releaseDate: releaseDate ? new Date(releaseDate) : new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "CHAPTER_CREATED",
        entityType: "Chapter",
        entityId: chapter.id,
        details: { mangaId, chapterNumber: chapter.chapterNumber, title: chapter.chapterTitle },
      },
    });

    return NextResponse.json({ success: true, chapter }, { status: 201 });
  } catch (err: any) {
    console.error("Create chapter error:", err);
    return NextResponse.json({ error: err.message || "Failed to create chapter" }, { status: 500 });
  }
}
