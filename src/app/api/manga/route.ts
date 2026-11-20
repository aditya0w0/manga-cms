import { NextRequest, NextResponse } from "next/server";
import { getMangaList } from "@/modules/manga/manga-service";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { ContentPolicyService } from "@/modules/content-policy/content-policy-service";
import { MangaStatus, ContentType, PublicationStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || searchParams.get("query") || undefined;
    const genre = searchParams.get("genre");
    const genreSlugs = genre ? genre.split(",").map((s) => s.trim()) : undefined;
    const status = (searchParams.get("status") as MangaStatus) || undefined;
    const contentType = (searchParams.get("contentType") as ContentType) || undefined;
    const releaseYear = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
    const minRating = searchParams.get("minRating") ? Number(searchParams.get("minRating")) : undefined;
    const language = searchParams.get("lang") || undefined;
    const sortBy = (searchParams.get("sortBy") as any) || "popularity";
    const sortOrder = (searchParams.get("sortOrder") as any) || "desc";
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 24;

    const result = await getMangaList({
      query,
      genreSlugs,
      status,
      contentType,
      releaseYear,
      minRating,
      language,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Manga listing error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch manga" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const db = await getPrisma();

    const {
      title,
      slug,
      alternativeTitles,
      description,
      coverUrl,
      bannerUrl,
      author,
      artist,
      releaseYear,
      status = MangaStatus.ONGOING,
      contentType = ContentType.MANGA,
      publicationStatus = PublicationStatus.PUBLISHED,
      language = "en",
      isFeatured = false,
      isTrending = false,
      genreIds = [],
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Resolve genre names for validation
    let genresList: string[] = [];
    if (Array.isArray(genreIds) && genreIds.length > 0) {
      const dbGenres = await db.genre.findMany({
        where: { id: { in: genreIds } },
        select: { name: true },
      });
      genresList = dbGenres.map((g) => g.name);
    }

    // Strict Global Content Exclusion Policy Check (Including WD Tagger Visual Scan)
    const policyCheck = await ContentPolicyService.evaluateMangaContent({
      title,
      alternativeTitles,
      description,
      genres: genresList,
      coverUrl,
    });

    if (!policyCheck.allowed || policyCheck.action === "REJECT") {
      return NextResponse.json(
        { error: `Content policy violation: ${policyCheck.reason}`, violations: policyCheck.violations },
        { status: 400 }
      );
    }

    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const effectivePubStatus =
      policyCheck.action === "QUARANTINE"
        ? PublicationStatus.PENDING_REVIEW
        : (publicationStatus || PublicationStatus.PUBLISHED);

    const manga = await db.manga.create({
      data: {
        title: title.trim(),
        slug: finalSlug,
        alternativeTitles: alternativeTitles || [],
        description,
        coverUrl,
        bannerUrl,
        author,
        artist,
        releaseYear: releaseYear ? Number(releaseYear) : undefined,
        status,
        contentType,
        publicationStatus: effectivePubStatus,
        language,
        isFeatured: Boolean(isFeatured),
        isTrending: Boolean(isTrending),
        rawMetadata: (policyCheck.visualClassification || policyCheck.action === "QUARANTINE" ? {
          visualClassification: policyCheck.visualClassification,
          hitlReason: policyCheck.reason,
          hitlRequired: policyCheck.hitlRequired,
        } : undefined) as any,
        genres: {
          create: genreIds.map((genreId: string) => ({
            genre: { connect: { id: genreId } },
          })),
        },
      },
      include: {
        genres: { include: { genre: true } },
      },
    });

    // Create Audit Log
    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "MANGA_CREATED",
        entityType: "Manga",
        entityId: manga.id,
        details: { title: manga.title, slug: manga.slug },
      },
    });

    return NextResponse.json({ success: true, manga }, { status: 201 });
  } catch (err: any) {
    console.error("Create manga error:", err);
    return NextResponse.json({ error: err.message || "Failed to create manga" }, { status: 500 });
  }
}
