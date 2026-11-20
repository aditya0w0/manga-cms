import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const db = await getPrisma();

    const job = await db.aPIImportJob.findUnique({
      where: { id: params.id },
      include: {
        provider: true,
        records: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            manga: { select: { id: true, title: true, slug: true } },
            chapter: { select: { id: true, chapterNumber: true, chapterTitle: true } },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch import job" }, { status: 500 });
  }
}
