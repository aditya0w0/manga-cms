import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const db = await getPrisma();

    const quarantined = await db.manga.findMany({
      where: {
        publicationStatus: PublicationStatus.PENDING_REVIEW,
      },
      include: {
        genres: { include: { genre: true } },
        provider: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      quarantined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}
