import { NextRequest, NextResponse } from "next/server";
import { getChapterWithPages } from "@/modules/chapters/chapter-service";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const chapter = await getChapterWithPages(params.id);
    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }
    return NextResponse.json({ chapter });
  } catch (err: any) {
    console.error("Get chapter error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch chapter" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const db = await getPrisma();

    const { chapterNumber, chapterTitle, volume, language, scanlationGroup, publicationStatus } = body;

    const updated = await db.chapter.update({
      where: { id: params.id },
      data: {
        chapterNumber: chapterNumber !== undefined ? Number(chapterNumber) : undefined,
        chapterTitle: chapterTitle !== undefined ? chapterTitle : undefined,
        volume: volume !== undefined ? Number(volume) : undefined,
        language: language || undefined,
        scanlationGroup: scanlationGroup !== undefined ? scanlationGroup : undefined,
        publicationStatus: publicationStatus || undefined,
      },
    });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "CHAPTER_UPDATED",
        entityType: "Chapter",
        entityId: params.id,
        details: { chapterNumber: updated.chapterNumber, title: updated.chapterTitle },
      },
    });

    return NextResponse.json({ success: true, chapter: updated });
  } catch (err: any) {
    console.error("Update chapter error:", err);
    return NextResponse.json({ error: err.message || "Failed to update chapter" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const db = await getPrisma();

    await db.chapter.delete({
      where: { id: params.id },
    });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "CHAPTER_DELETED",
        entityType: "Chapter",
        entityId: params.id,
      },
    });

    return NextResponse.json({ success: true, message: "Chapter deleted" });
  } catch (err: any) {
    console.error("Delete chapter error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete chapter" }, { status: 500 });
  }
}
