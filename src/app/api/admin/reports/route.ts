import { NextRequest, NextResponse } from "next/server";
import { requireModerator } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { ReportStatus } from "@prisma/client";

export async function GET() {
  try {
    await requireModerator();
    const db = await getPrisma();

    const reports = await db.contentReport.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reporter: { select: { id: true, username: true, email: true } },
        manga: { select: { id: true, title: true, slug: true } },
        chapter: { select: { id: true, chapterNumber: true, chapterTitle: true } },
      },
    });

    return NextResponse.json({ reports });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch reports" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const mod = await requireModerator();
    const body = await req.json();
    const { id, status, moderatorNotes } = body;
    const db = await getPrisma();

    const updated = await db.contentReport.update({
      where: { id },
      data: {
        status: status as ReportStatus,
        moderatorNotes: moderatorNotes !== undefined ? moderatorNotes : undefined,
      },
    });

    await db.auditLog.create({
      data: {
        userId: mod.id,
        action: "REPORT_REVIEWED",
        entityType: "ContentReport",
        entityId: id,
        details: { status },
      },
    });

    return NextResponse.json({ success: true, report: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update report" }, { status: 500 });
  }
}
