import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    const user = await requireAuth();
    const db = await getPrisma();

    const history = await db.readingHistory.findMany({
      where: { userId: user.id },
      orderBy: { lastReadAt: "desc" },
      take: 50,
      include: {
        manga: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverUrl: true,
          },
        },
        chapter: {
          select: {
            id: true,
            chapterNumber: true,
            chapterTitle: true,
          },
        },
      },
    });

    return NextResponse.json({ history });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}
