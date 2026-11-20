import { getPrisma } from "@/lib/database/prisma";
import {
  PublicationStatus,
  ContentRating,
  ContributionRole,
  Prisma,
} from "@prisma/client";
import { AuditService } from "../audit/audit-service";
import { MediaStorageService } from "../media/media-storage-service";

export interface CreateMangaInput {
  title: string;
  slug?: string;
  alternativeTitles?: string[];
  description?: string;
  coverImageId?: string;
  publicationStatus?: PublicationStatus;
  contentRating?: ContentRating;
  originalLanguage?: string;
  releaseYear?: number;
  createdById?: string;
  authorIds?: { authorId: string; role?: ContributionRole }[];
  genreIds?: string[];
  tagIds?: string[];
}

export interface UpdateMangaInput {
  title?: string;
  slug?: string;
  alternativeTitles?: string[];
  description?: string;
  coverImageId?: string;
  publicationStatus?: PublicationStatus;
  contentRating?: ContentRating;
  originalLanguage?: string;
  releaseYear?: number;
  authorIds?: { authorId: string; role?: ContributionRole }[];
  genreIds?: string[];
  tagIds?: string[];
}

export interface MangaQueryFilter {
  page?: number;
  limit?: number;
  query?: string;
  genre?: string;
  tag?: string;
  author?: string;
  publicationStatus?: PublicationStatus;
  contentRating?: ContentRating;
  language?: string;
  sortBy?: "latest" | "popular" | "rating" | "title";
  sortOrder?: "asc" | "desc";
  includeUnpublished?: boolean;
}

export class MangaCmsService {
  /**
   * Helper to generate a slug from title.
   */
  static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Create a new manga series.
   */
  static async createManga(input: CreateMangaInput, actorId?: string) {
    if (!input.title || typeof input.title !== "string" || !input.title.trim()) {
      throw new Error("VALIDATION_ERROR: Manga title cannot be empty");
    }
    if (input.title.length > 255) {
      throw new Error("VALIDATION_ERROR: Manga title exceeds 255 characters");
    }
    if (input.releaseYear !== undefined && input.releaseYear !== null) {
      if (input.releaseYear < 1800 || input.releaseYear > 2100) {
        throw new Error("VALIDATION_ERROR: releaseYear must be between 1800 and 2100");
      }
    }

    const db = await getPrisma();
    const slug = input.slug || this.generateSlug(input.title);

    // Verify slug uniqueness (including across table unique constraint)
    const existing = await db.manga.findFirst({
      where: { slug },
    });
    if (existing) {
      throw new Error(`SLUG_EXISTS: A manga with slug "${slug}" already exists`);
    }

    const manga = await db.manga.create({
      data: {
        title: input.title,
        slug,
        alternativeTitles: input.alternativeTitles ?? [],
        description: input.description,
        coverImageId: input.coverImageId,
        publicationStatus: input.publicationStatus || PublicationStatus.DRAFT,
        contentRating: input.contentRating || ContentRating.SAFE,
        originalLanguage: input.originalLanguage || "ja",
        releaseYear: input.releaseYear,
        createdById: input.createdById || actorId,
        authors: input.authorIds
          ? {
              create: input.authorIds.map((a) => ({
                authorId: a.authorId,
                contributionRole: a.role || ContributionRole.STORY_AND_ART,
              })),
            }
          : undefined,
        genres: input.genreIds
          ? {
              create: input.genreIds.map((id) => ({ genreId: id })),
            }
          : undefined,
        tags: input.tagIds
          ? {
              create: input.tagIds.map((id) => ({ tagId: id })),
            }
          : undefined,
      },
      include: {
        coverImage: true,
        authors: { include: { author: true } },
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
    });

    await AuditService.log({
      actorId,
      action: "MANGA_CREATED",
      entityType: "Manga",
      entityId: manga.id,
      changes: { title: manga.title, slug: manga.slug },
    });

    return manga;
  }

  /**
   * Update an existing manga series.
   */
  static async updateManga(id: string, input: UpdateMangaInput, actorId?: string) {
    const db = await getPrisma();
    const existing = await db.manga.findUnique({
      where: { id },
      include: { authors: true, genres: true, tags: true },
    });
    if (!existing || existing.deletedAt) {
      throw new Error("MANGA_NOT_FOUND");
    }

    if (input.slug && input.slug !== existing.slug) {
      const conflict = await db.manga.findFirst({
        where: { slug: input.slug, id: { not: id }, deletedAt: null },
      });
      if (conflict) {
        throw new Error(`SLUG_EXISTS: Slug "${input.slug}" is already in use`);
      }
    }

    const data: Prisma.MangaUpdateInput = {
      title: input.title,
      slug: input.slug,
      description: input.description,
      publicationStatus: input.publicationStatus,
      contentRating: input.contentRating,
      originalLanguage: input.originalLanguage,
      releaseYear: input.releaseYear,
      alternativeTitles: input.alternativeTitles,
      updatedAt: new Date(),
    };

    if (input.coverImageId !== undefined) {
      data.coverImage = input.coverImageId
        ? { connect: { id: input.coverImageId } }
        : { disconnect: true };
    }

    // Update authors if supplied
    if (input.authorIds) {
      await db.mangaAuthor.deleteMany({ where: { mangaId: id } });
      data.authors = {
        create: input.authorIds.map((a) => ({
          authorId: a.authorId,
          contributionRole: a.role || ContributionRole.STORY_AND_ART,
        })),
      };
    }

    // Update genres if supplied
    if (input.genreIds) {
      await db.mangaGenre.deleteMany({ where: { mangaId: id } });
      data.genres = {
        create: input.genreIds.map((gid) => ({ genreId: gid })),
      };
    }

    // Update tags if supplied
    if (input.tagIds) {
      await db.mangaTag.deleteMany({ where: { mangaId: id } });
      data.tags = {
        create: input.tagIds.map((tid) => ({ tagId: tid })),
      };
    }

    const updated = await db.manga.update({
      where: { id },
      data,
      include: {
        coverImage: true,
        authors: { include: { author: true } },
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
    });

    await AuditService.log({
      actorId,
      action: "MANGA_UPDATED",
      entityType: "Manga",
      entityId: id,
      changes: input,
    });

    return updated;
  }

  /**
   * Soft deletes a manga series.
   */
  static async deleteManga(id: string, actorId?: string) {
    const db = await getPrisma();
    const existing = await db.manga.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new Error("MANGA_NOT_FOUND");
    }

    const deleted = await db.manga.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        slug: `${existing.slug}-deleted-${Date.now()}`,
      },
    });

    await AuditService.log({
      actorId,
      action: "MANGA_DELETED",
      entityType: "Manga",
      entityId: id,
      changes: { softDeleted: true, title: existing.title },
    });

    return deleted;
  }

  /**
   * Sets cover image for manga.
   */
  static async setMangaCover(mangaId: string, mediaId: string, actorId?: string) {
    const db = await getPrisma();
    const media = await db.media.findUnique({ where: { id: mediaId } });
    if (!media) throw new Error("MEDIA_NOT_FOUND");

    const updated = await db.manga.update({
      where: { id: mangaId },
      data: {
        coverImageId: mediaId,
        coverUrl: MediaStorageService.getMediaUrl(media.storageKey),
        updatedAt: new Date(),
      },
      include: { coverImage: true },
    });

    await AuditService.log({
      actorId,
      action: "MANGA_COVER_UPDATED",
      entityType: "Manga",
      entityId: mangaId,
      changes: { coverImageId: mediaId },
    });

    return updated;
  }

  /**
   * Public discovery / list query operating purely on internal DB.
   */
  static async queryManga(filter: MangaQueryFilter = {}) {
    const db = await getPrisma();
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.MangaWhereInput = {
      deletedAt: null,
    };

    if (!filter.includeUnpublished) {
      where.publicationStatus = PublicationStatus.PUBLISHED;
    } else if (filter.publicationStatus) {
      where.publicationStatus = filter.publicationStatus;
    }

    if (filter.contentRating) {
      where.contentRating = filter.contentRating;
    }

    if (filter.language) {
      where.originalLanguage = filter.language;
    }

    if (filter.query) {
      const q = filter.query.slice(0, 200).trim();
      if (q.length > 0) {
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ];
      }
    }

    if (filter.genre) {
      where.genres = {
        some: {
          genre: {
            OR: [
              { slug: filter.genre.toLowerCase() },
              { name: { equals: filter.genre, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    if (filter.tag) {
      where.tags = {
        some: {
          tag: {
            OR: [
              { slug: filter.tag.toLowerCase() },
              { name: { equals: filter.tag, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    if (filter.author) {
      where.authors = {
        some: {
          author: {
            name: { contains: filter.author, mode: "insensitive" },
          },
        },
      };
    }

    let orderBy: Prisma.MangaOrderByWithRelationInput = { createdAt: "desc" };
    if (filter.sortBy === "popular") {
      orderBy = { viewCount: filter.sortOrder || "desc" };
    } else if (filter.sortBy === "rating") {
      orderBy = { rating: filter.sortOrder || "desc" };
    } else if (filter.sortBy === "title") {
      orderBy = { title: filter.sortOrder || "asc" };
    } else if (filter.sortBy === "latest") {
      orderBy = { updatedAt: filter.sortOrder || "desc" };
    }

    const [items, total] = await Promise.all([
      db.manga.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          coverImage: true,
          genres: { include: { genre: true } },
          tags: { include: { tag: true } },
          authors: { include: { author: true } },
          _count: {
            select: {
              chapters: filter.includeUnpublished
                ? true
                : { where: { publicationStatus: PublicationStatus.PUBLISHED } },
            },
          },
        },
      }),
      db.manga.count({ where }),
    ]);

    return {
      items: items.map((m) => ({
        ...m,
        coverUrl: m.coverImage
          ? MediaStorageService.getMediaUrl(m.coverImage.storageKey)
          : m.coverUrl,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves single published manga by slug.
   */
  static async getMangaBySlug(slug: string, includeUnpublished = false) {
    const db = await getPrisma();
    const manga = await db.manga.findFirst({
      where: {
        slug,
        deletedAt: null,
        ...(includeUnpublished ? {} : { publicationStatus: PublicationStatus.PUBLISHED }),
      },
      include: {
        coverImage: true,
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
        authors: { include: { author: true } },
        translations: {
          where: includeUnpublished ? {} : { status: "PUBLISHED" },
        },
        _count: {
          select: {
            chapters: includeUnpublished
              ? true
              : { where: { publicationStatus: PublicationStatus.PUBLISHED } },
          },
        },
      },
    });

    if (!manga) return null;

    return {
      ...manga,
      coverUrl: manga.coverImage
        ? MediaStorageService.getMediaUrl(manga.coverImage.storageKey)
        : manga.coverUrl,
    };
  }
}
