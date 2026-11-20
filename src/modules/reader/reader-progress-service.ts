import { getPrisma } from "@/lib/database/prisma";

export class ReaderProgressService {
  /**
   * Records or updates user reading progress for a chapter.
   * Validates positive integer page numbers and relational integrity.
   */
  static async updateProgress(userId: string, mangaId: string, chapterId: string, pageNumber: number) {
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new Error("INVALID_PAGE_NUMBER: Page number must be a positive integer >= 1");
    }

    const db = await getPrisma();

    // Verify chapter exists and belongs to the specified manga
    const chapter = await db.chapter.findFirst({
      where: {
        id: chapterId,
        mangaId,
        manga: { deletedAt: null },
      },
    });

    if (!chapter) {
      throw new Error("INVALID_CHAPTER_REFERENCE: Chapter does not belong to specified manga or manga is deleted");
    }

    return db.readingProgress.upsert({
      where: {
        userId_mangaId_chapterId: {
          userId,
          mangaId,
          chapterId,
        },
      },
      create: {
        userId,
        mangaId,
        chapterId,
        pageNumber,
      },
      update: {
        pageNumber,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Gets reading progress for a specific manga and user.
   */
  static async getProgress(userId: string, mangaId: string) {
    const db = await getPrisma();
    return db.readingProgress.findMany({
      where: {
        userId,
        mangaId,
        manga: { deletedAt: null },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        chapter: {
          select: { id: true, chapterNumber: true, title: true },
        },
      },
    });
  }

  /**
   * Toggles bookmark / favorite for a manga.
   * Verifies that target manga exists and is not soft-deleted.
   */
  static async toggleBookmark(userId: string, mangaId: string) {
    const db = await getPrisma();

    const manga = await db.manga.findFirst({
      where: { id: mangaId, deletedAt: null },
    });
    if (!manga) {
      throw new Error("MANGA_NOT_FOUND: Target manga does not exist");
    }

    const existing = await db.bookmark.findUnique({
      where: {
        userId_mangaId: { userId, mangaId },
      },
    });

    if (existing) {
      await db.bookmark.delete({
        where: { id: existing.id },
      });
      return { bookmarked: false };
    }

    const created = await db.bookmark.create({
      data: { userId, mangaId },
    });
    return { bookmarked: true, bookmark: created };
  }

  /**
   * Lists bookmarked manga for a user.
   */
  static async getUserBookmarks(userId: string) {
    const db = await getPrisma();
    return db.bookmark.findMany({
      where: {
        userId,
        manga: { deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
      include: {
        manga: {
          include: {
            coverImage: true,
            _count: { select: { chapters: true } },
          },
        },
      },
    });
  }
}
