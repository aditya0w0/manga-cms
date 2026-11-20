import { NextRequest, NextResponse } from "next/server";
import { getMangaBySlug } from "@/modules/manga/manga-service";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";
import { ContentPolicyService } from "@/modules/content-policy/content-policy-service";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const manga = await getMangaBySlug(params.slug);
    if (!manga) {
      return NextResponse.json({ error: "Manga not found" }, { status: 404 });
    }
    return NextResponse.json({ manga });
  } catch (err: any) {
    console.error("Get manga by slug error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch manga" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const db = await getPrisma();

    const existing = await db.manga.findUnique({
      where: { slug: params.slug },
    });

    if (!existing) {
      return NextResponse.json({ error: "Manga not found" }, { status: 404 });
    }

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
      status,
      contentType,
      publicationStatus,
      isFeatured,
      isTrending,
      genreIds,
    } = body;

    // Strict Revalidation against Content Policy
    let genresList: string[] = [];
    if (Array.isArray(genreIds)) {
      const dbGenres = await db.genre.findMany({
        where: { id: { in: genreIds } },
        select: { name: true },
      });
      genresList = dbGenres.map((g) => g.name);
    } else {
      const existingGenres = await db.mangaGenre.findMany({
        where: { mangaId: existing.id },
        include: { genre: true },
      });
      genresList = existingGenres.map((mg) => mg.genre.name);
    }

    const policyCheck = await ContentPolicyService.evaluateMangaContent({
      title: title ?? existing.title,
      alternativeTitles: alternativeTitles ?? (existing.alternativeTitles as any),
      description: description ?? existing.description ?? undefined,
      genres: genresList,
      coverUrl: coverUrl !== undefined ? coverUrl : existing.coverUrl || undefined,
    });

    if (!policyCheck.allowed || policyCheck.action === "REJECT") {
      return NextResponse.json(
        { error: `Content policy violation: ${policyCheck.reason}`, violations: policyCheck.violations },
        { status: 400 }
      );
    }

    const effectivePubStatus =
      policyCheck.action === "QUARANTINE"
        ? PublicationStatus.PENDING_REVIEW
        : (publicationStatus || existing.publicationStatus);

    const updated = await db.$transaction(async (tx) => {
      // If genreIds provided, replace associations
      if (Array.isArray(genreIds)) {
        await tx.mangaGenre.deleteMany({ where: { mangaId: existing.id } });
        for (const gId of genreIds) {
          await tx.mangaGenre.create({
            data: { mangaId: existing.id, genreId: gId },
          });
        }
      }

      return tx.manga.update({
        where: { id: existing.id },
        data: {
          title: title !== undefined ? title : existing.title,
          slug: slug !== undefined ? slug : existing.slug,
          alternativeTitles: alternativeTitles !== undefined ? alternativeTitles : existing.alternativeTitles,
          description: description !== undefined ? description : existing.description,
          coverUrl: coverUrl !== undefined ? coverUrl : existing.coverUrl,
          bannerUrl: bannerUrl !== undefined ? bannerUrl : existing.bannerUrl,
          author: author !== undefined ? author : existing.author,
          artist: artist !== undefined ? artist : existing.artist,
          releaseYear: releaseYear !== undefined ? Number(releaseYear) : existing.releaseYear,
          status: status || existing.status,
          contentType: contentType || existing.contentType,
          publicationStatus: effectivePubStatus,
          rawMetadata: (policyCheck.visualClassification || policyCheck.action === "QUARANTINE" ? {
            ...(typeof existing.rawMetadata === "object" ? (existing.rawMetadata as any) : {}),
            visualClassification: policyCheck.visualClassification,
            hitlReason: policyCheck.reason,
            hitlRequired: policyCheck.hitlRequired,
          } : existing.rawMetadata ?? undefined) as any,
          isFeatured: isFeatured !== undefined ? Boolean(isFeatured) : existing.isFeatured,
          isTrending: isTrending !== undefined ? Boolean(isTrending) : existing.isTrending,
        },
        include: {
          genres: { include: { genre: true } },
        },
      });
    });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "MANGA_UPDATED",
        entityType: "Manga",
        entityId: existing.id,
        details: { title: updated.title, slug: updated.slug },
      },
    });

    return NextResponse.json({ success: true, manga: updated });
  } catch (err: any) {
    console.error("Update manga error:", err);
    return NextResponse.json({ error: err.message || "Failed to update manga" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const admin = await requireAdmin();
    const db = await getPrisma();

    const existing = await db.manga.findUnique({
      where: { slug: params.slug },
    });

    if (!existing) {
      return NextResponse.json({ error: "Manga not found" }, { status: 404 });
    }

    await db.manga.delete({
      where: { id: existing.id },
    });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "MANGA_DELETED",
        entityType: "Manga",
        entityId: existing.id,
        details: { title: existing.title, slug: existing.slug },
      },
    });

    return NextResponse.json({ success: true, message: "Manga deleted" });
  } catch (err: any) {
    console.error("Delete manga error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete manga" }, { status: 500 });
  }
}
