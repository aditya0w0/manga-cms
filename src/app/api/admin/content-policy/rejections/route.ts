import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const db = await getPrisma();

    const rejections = await db.aPIImportRecord.findMany({
      where: {
        errorMessage: { contains: "POLICY_VIOLATION" },
      },
      include: {
        job: {
          include: {
            provider: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ rejections });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}
