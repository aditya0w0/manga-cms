import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";
import { WdTaggerService } from "@/modules/content-policy/wd-tagger-service";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const db = await getPrisma();

    const quarantinedManga = await db.manga.findMany({
      where: {
        publicationStatus: PublicationStatus.PENDING_REVIEW,
      },
      include: {
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
        provider: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const items = await Promise.all(
      quarantinedManga.map(async (m) => {
        const raw = (m.rawMetadata as any) || {};
        let visualClassification = raw.visualClassification;

        // If not already classified and coverUrl is present, fetch classification
        if (!visualClassification && m.coverUrl) {
          try {
            visualClassification = await WdTaggerService.classifyImage(m.coverUrl);
          } catch {
            visualClassification = undefined;
          }
        }

        const isVisualFlag = !!(
          raw.hitlReason?.includes("WD Tagger") ||
          raw.hitlReason?.includes("artwork") ||
          (visualClassification && visualClassification.hitlRequired)
        );

        return {
          id: m.id,
          slug: m.slug,
          title: m.title,
          coverUrl: m.coverUrl,
          bannerUrl: m.bannerUrl,
          author: m.author,
          artist: m.artist,
          status: m.status,
          contentType: m.contentType,
          publicationStatus: m.publicationStatus,
          genres: m.genres.map((g) => g.genre.name),
          tags: m.tags.map((t) => t.tag.name),
          provider: m.provider?.name || "Local / Manual",
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          hitlReason: raw.hitlReason || (isVisualFlag ? "Borderline artwork detected by WD Tagger" : "Unclassified / ambiguous metadata"),
          visualClassification: visualClassification || null,
          isVisualFlag,
        };
      })
    );

    return NextResponse.json({
      items,
      count: items.length,
      visualCount: items.filter((i) => i.isVisualFlag).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}
