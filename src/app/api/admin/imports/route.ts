import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const db = await getPrisma();

    const jobs = await db.aPIImportJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        provider: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { records: true },
        },
      },
    });

    return NextResponse.json({ jobs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch import jobs" }, { status: 500 });
  }
}
