import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit-service";
import { MediaStorageService } from "../media/media-storage-service";

export interface CreateChapterInput {
  mangaId: string;
  chapterNumber: number;
  volumeNumber?: number | null;
  title?: string | null;
  slug?: string | null;
  language?: string;
  publicationStatus?: PublicationStatus;
  publishedAt?: Date | null;
  createdById?: string;
}

export interface UpdateChapterInput {
  chapterNumber?: number;
  volumeNumber?: number | null;
  title?: string | null;
  slug?: string | null;
  language?: string;
  publicationStatus?: PublicationStatus;
  publishedAt?: Date | null;
}

export interface ReorderPageItem {
  pageId: string;
  pageNumber: number;
}

export class ChapterCmsService {
  /**
   * Creates a new chapter under a manga series.
   */
  static async createChapter(input: CreateChapterInput, actorId?: string) {
    if (input.chapterNumber < 0 || isNaN(input.chapterNumber)) {
      throw new Error("INVALID_CHAPTER_NUMBER: Chapter number must be a non-negative number");
    }
    if (input.volumeNumber !== undefined && input.volumeNumber !== null && input.volumeNumber < 0) {
      throw new Error("INVALID_VOLUME_NUMBER: Volume number cannot be negative");
    }

    const db = await getPrisma();

    // Verify manga exists and is not soft-deleted
    const manga = await db.manga.findFirst({
      where: { id: input.mangaId, deletedAt: null },
    });
    if (!manga) {
      throw new Error("MANGA_NOT_FOUND");
    }

    const language = (input.language || "en").toLowerCase();

    // Check for duplicate chapter number within the same series and language
    const existing = await db.chapter.findUnique({
      where: {
        mangaId_chapterNumber_language: {
          mangaId: input.mangaId,
          chapterNumber: input.chapterNumber,
          language,
        },
      },
    });
    if (existing) {
      throw new Error(`DUPLICATE_CHAPTER: Chapter ${input.chapterNumber} (${language}) already exists for this manga`);
    }

    const isPublished = input.publicationStatus === PublicationStatus.PUBLISHED;

    const chapter = await db.chapter.create({
      data: {
        mangaId: input.mangaId,
        chapterNumber: input.chapterNumber,
        volumeNumber: input.volumeNumber ?? null,
        volume: input.volumeNumber ?? null,
        title: input.title ?? null,
        chapterTitle: input.title ?? null,
        slug: input.slug ?? `ch-${input.chapterNumber}`,
        language,
        publicationStatus: input.publicationStatus || PublicationStatus.DRAFT,
        publishedAt: isPublished ? (input.publishedAt || new Date()) : null,
        createdById: input.createdById || actorId,
      },
      include: {
        pages: true,
      },
    });

    await AuditService.log({
      actorId,
      action: "CHAPTER_CREATED",
      entityType: "Chapter",
      entityId: chapter.id,
      changes: {
        mangaId: input.mangaId,
        chapterNumber: input.chapterNumber,
        language,
      },
    });

    return chapter;
  }

  /**
   * Updates chapter metadata.
   */
  static async updateChapter(id: string, input: UpdateChapterInput, actorId?: string) {
    const db = await getPrisma();
    const existing = await db.chapter.findUnique({ where: { id } });
    if (!existing) throw new Error("CHAPTER_NOT_FOUND");

    const data: Prisma.ChapterUpdateInput = {
      chapterNumber: input.chapterNumber,
      volumeNumber: input.volumeNumber,
      volume: input.volumeNumber,
      title: input.title,
      chapterTitle: input.title,
      slug: input.slug,
      language: input.language ? input.language.toLowerCase() : undefined,
      publicationStatus: input.publicationStatus,
      publishedAt: input.publishedAt,
      updatedAt: new Date(),
    };

    const updated = await db.chapter.update({
      where: { id },
      data,
    });

    await AuditService.log({
      actorId,
      action: "CHAPTER_UPDATED",
      entityType: "Chapter",
      entityId: id,
      changes: input,
    });

    return updated;
  }

  /**
   * Deletes chapter and its associated pages.
   */
  static async deleteChapter(id: string, actorId?: string) {
    const db = await getPrisma();
    const existing = await db.chapter.findUnique({ where: { id } });
    if (!existing) throw new Error("CHAPTER_NOT_FOUND");

    await db.chapter.delete({ where: { id } });

    await AuditService.log({
      actorId,
      action: "CHAPTER_DELETED",
      entityType: "Chapter",
      entityId: id,
      changes: { chapterNumber: existing.chapterNumber, mangaId: existing.mangaId },
    });

    return true;
  }

  /**
   * Publishes a chapter.
   */
  static async publishChapter(id: string, actorId?: string) {
    const db = await getPrisma();
    const existing = await db.chapter.findUnique({
      where: { id },
      include: { _count: { select: { pages: true } } },
    });
    if (!existing) throw new Error("CHAPTER_NOT_FOUND");

    if (existing._count.pages === 0) {
      throw new Error("CANNOT_PUBLISH_EMPTY_CHAPTER: Cannot publish a chapter with 0 pages");
    }

    const updated = await db.chapter.update({
      where: { id },
      data: {
        publicationStatus: PublicationStatus.PUBLISHED,
        publishedAt: existing.publishedAt || new Date(),
        updatedAt: new Date(),
      },
    });

    await AuditService.log({
      actorId,
      action: "CHAPTER_PUBLISHED",
      entityType: "Chapter",
      entityId: id,
    });

    return updated;
  }

  /**
   * Unpublishes a chapter (reverts to DRAFT).
   */
  static async unpublishChapter(id: string, actorId?: string) {
    const db = await getPrisma();
    const updated = await db.chapter.update({
      where: { id },
      data: {
        publicationStatus: PublicationStatus.DRAFT,
        updatedAt: new Date(),
      },
    });

    await AuditService.log({
      actorId,
      action: "CHAPTER_UNPUBLISHED",
      entityType: "Chapter",
      entityId: id,
    });

    return updated;
  }

  /**
   * Add a single page to a chapter.
   */
  static async addPage(
    chapterId: string,
    imageId: string,
    pageNumber?: number,
    actorId?: string
  ) {
    const db = await getPrisma();
    const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new Error("CHAPTER_NOT_FOUND");

    const media = await db.media.findUnique({ where: { id: imageId } });
    if (!media) throw new Error("MEDIA_NOT_FOUND");

    // If pageNumber is not provided, append to end
    let resolvedPageNum = pageNumber;
    if (!resolvedPageNum) {
      const maxPage = await db.chapterPage.aggregate({
        where: { chapterId },
        _max: { pageNumber: true },
      });
      resolvedPageNum = (maxPage._max.pageNumber || 0) + 1;
    }

    const page = await db.chapterPage.create({
      data: {
        chapterId,
        pageNumber: resolvedPageNum,
        imageId,
        imageUrl: MediaStorageService.getMediaUrl(media.storageKey),
        storageKey: media.storageKey,
        width: media.width,
        height: media.height,
        fileSize: media.fileSize,
      },
    });

    return page;
  }

  /**
   * Deletes a page from chapter and re-sequences remaining pages sequentially.
   */
  static async deletePage(pageId: string, actorId?: string) {
    const db = await getPrisma();
    const page = await db.chapterPage.findUnique({ where: { id: pageId } });
    if (!page) throw new Error("PAGE_NOT_FOUND");

    await db.$transaction(async (tx) => {
      await tx.chapterPage.delete({ where: { id: pageId } });
      const remaining = await tx.chapterPage.findMany({
        where: { chapterId: page.chapterId },
        orderBy: { pageNumber: "asc" },
      });
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].pageNumber !== i + 1) {
          await tx.chapterPage.update({
            where: { id: remaining[i].id },
            data: { pageNumber: i + 1 },
          });
        }
      }
    });

    return true;
  }

  /**
   * Deterministically reorders pages for a chapter.
   * Strictly validates that all pages belong to the targeted chapter (Cross-Chapter IDOR defense).
   */
  static async reorderPages(
    chapterId: string,
    orders: ReorderPageItem[],
    actorId?: string
  ) {
    if (!orders || orders.length === 0) {
      throw new Error("VALIDATION_ERROR: Orders list cannot be empty");
    }

    const seenPageIds = new Set<string>();
    const seenPageNumbers = new Set<number>();

    for (const item of orders) {
      if (!item.pageId || typeof item.pageId !== "string") {
        throw new Error("VALIDATION_ERROR: Missing or invalid pageId");
      }
      if (!Number.isInteger(item.pageNumber) || item.pageNumber <= 0) {
        throw new Error("VALIDATION_ERROR: pageNumber must be a positive integer");
      }
      if (seenPageIds.has(item.pageId)) {
        throw new Error(`VALIDATION_ERROR: Duplicate pageId "${item.pageId}" in reorder payload`);
      }
      if (seenPageNumbers.has(item.pageNumber)) {
        throw new Error(`VALIDATION_ERROR: Duplicate pageNumber "${item.pageNumber}" in reorder payload`);
      }
      seenPageIds.add(item.pageId);
      seenPageNumbers.add(item.pageNumber);
    }

    const db = await getPrisma();
    const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new Error("CHAPTER_NOT_FOUND");

    const existingPages = await db.chapterPage.findMany({
      where: { chapterId },
      select: { id: true },
    });
    const validPageIds = new Set(existingPages.map((p) => p.id));

    for (const item of orders) {
      if (!validPageIds.has(item.pageId)) {
        throw new Error(`PAGE_CHAPTER_MISMATCH: Page "${item.pageId}" does not belong to chapter "${chapterId}"`);
      }
    }

    await db.$transaction(async (tx) => {
      // Temporarily offset page numbers to avoid unique constraint violations
      for (const item of orders) {
        await tx.chapterPage.update({
          where: { id: item.pageId },
          data: { pageNumber: item.pageNumber + 10000 },
        });
      }

      // Assign target sequential page numbers
      for (const item of orders) {
        await tx.chapterPage.update({
          where: { id: item.pageId },
          data: { pageNumber: item.pageNumber },
        });
      }
    });

    await AuditService.log({
      actorId,
      action: "CHAPTER_PAGES_REORDERED",
      entityType: "Chapter",
      entityId: chapterId,
      changes: { pagesCount: orders.length },
    });

    return db.chapterPage.findMany({
      where: { chapterId },
      orderBy: { pageNumber: "asc" },
      include: { image: true },
    });
  }

  /**
   * Retrieves chapter navigation: previous, current, next, manga, and available languages.
   * Public safety: Never returns unpublished chapters.
   */
  static async getChapterNavigation(chapterId: string, includeUnpublished = false) {
    const db = await getPrisma();
    const current = await db.chapter.findUnique({
      where: { id: chapterId },
      include: {
        manga: {
          select: {
            id: true,
            title: true,
            slug: true,
            publicationStatus: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!current || current.manga.deletedAt) {
      return null;
    }

    if (!includeUnpublished && current.publicationStatus !== PublicationStatus.PUBLISHED) {
      return null;
    }

    const pubFilter: Prisma.ChapterWhereInput = includeUnpublished
      ? {}
      : { publicationStatus: PublicationStatus.PUBLISHED };

    // Previous chapter: highest chapterNumber < current.chapterNumber in same manga and language
    const prevChapter = await db.chapter.findFirst({
      where: {
        mangaId: current.mangaId,
        language: current.language,
        chapterNumber: { lt: current.chapterNumber },
        ...pubFilter,
      },
      orderBy: { chapterNumber: "desc" },
      select: { id: true, chapterNumber: true, title: true, slug: true },
    });

    // Next chapter: lowest chapterNumber > current.chapterNumber in same manga and language
    const nextChapter = await db.chapter.findFirst({
      where: {
        mangaId: current.mangaId,
        language: current.language,
        chapterNumber: { gt: current.chapterNumber },
        ...pubFilter,
      },
      orderBy: { chapterNumber: "asc" },
      select: { id: true, chapterNumber: true, title: true, slug: true },
    });

    // Available languages for this manga
    const allChaptersForManga = await db.chapter.findMany({
      where: {
        mangaId: current.mangaId,
        ...pubFilter,
      },
      select: { language: true },
      distinct: ["language"],
    });

    return {
      manga: current.manga,
      current: {
        id: current.id,
        chapterNumber: current.chapterNumber,
        volumeNumber: current.volumeNumber,
        title: current.title,
        slug: current.slug,
        language: current.language,
        publishedAt: current.publishedAt,
      },
      previous: prevChapter,
      next: nextChapter,
      availableLanguages: allChaptersForManga.map((c) => c.language),
    };
  }

  /**
   * Retrieves full reader manifest for a manga slug and chapter ID.
   */
  static async getReaderManifest(
    mangaSlug: string,
    chapterId: string,
    includeUnpublished = false
  ) {
    const db = await getPrisma();
    const navigation = await this.getChapterNavigation(chapterId, includeUnpublished);
    if (!navigation || navigation.manga.slug !== mangaSlug) {
      return null;
    }

    const pages = await db.chapterPage.findMany({
      where: { chapterId },
      orderBy: { pageNumber: "asc" },
      include: { image: true },
    });

    // Available translations for this chapter
    const translations = await db.chapterTranslation.findMany({
      where: {
        chapterId,
        ...(includeUnpublished ? {} : { translationStatus: "PUBLISHED" }),
      },
    });

    return {
      manga: navigation.manga,
      chapter: navigation.current,
      navigation: {
        previous: navigation.previous,
        next: navigation.next,
      },
      readingDirection: "VERTICAL",
      availableLanguages: navigation.availableLanguages,
      availableTranslations: translations,
      totalPages: pages.length,
      pages: pages.map((p) => ({
        id: p.id,
        pageNumber: p.pageNumber,
        url: p.imageUrl,
        width: p.width || p.image?.width || null,
        height: p.height || p.image?.height || null,
        fileSize: p.fileSize || p.image?.fileSize || null,
      })),
    };
  }
}
