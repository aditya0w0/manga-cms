import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const body = await req.json();
    const db = await getPrisma();
    const action = body.action; // "APPROVE" | "REJECT" | "ARCHIVE"

    const manga = await db.manga.findUnique({
      where: { id: params.id },
    });

    if (!manga) {
      return NextResponse.json({ error: "Manga not found" }, { status: 404 });
    }

    if (action === "APPROVE") {
      await db.manga.update({
        where: { id: params.id },
        data: { publicationStatus: PublicationStatus.PUBLISHED },
      });
    } else if (action === "ARCHIVE" || action === "REJECT") {
      await db.manga.update({
        where: { id: params.id },
        data: { publicationStatus: PublicationStatus.ARCHIVED },
      });
    } else if (action === "DELETE") {
      await db.manga.delete({
        where: { id: params.id },
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await db.auditLog.create({
      data: {
        action: `QUARANTINE_REVIEW_${action}`,
        entityType: "Manga",
        entityId: params.id,
        details: { action, title: manga.title },
      },
    });

    return NextResponse.json({ success: true, actionApplied: action });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to review quarantined manga" }, { status: 500 });
  }
}
