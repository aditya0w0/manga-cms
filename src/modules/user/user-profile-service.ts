import { getPrisma } from "@/lib/database/prisma";
import { AuthService } from "@/modules/auth/auth-service";
import { LibraryStatus, Prisma } from "@prisma/client";

export interface UserStats {
  totalBookmarks: number;
  totalHistory: number;
  totalSaved: number;
  reading: number;
  completed: number;
  planToRead: number;
  onHold: number;
  dropped: number;
  favorites: number;
  chaptersReadCount: number;
}

export interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  stats: UserStats;
}

export class UserProfileService {
  /**
   * Retrieves user profile details and aggregate statistics.
   */
  static async getUserProfile(userId: string): Promise<UserProfileResponse> {
    const db = await getPrisma();

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND: User does not exist");
    }

    const [
      totalBookmarks,
      totalHistory,
      libraryStatusCounts,
      favoritesCount,
      chaptersProgressCount,
    ] = await Promise.all([
      db.bookmark.count({ where: { userId } }),
      db.readingHistory.count({ where: { userId } }),
      db.userLibrary.groupBy({
        by: ["status"],
        where: { userId },
        _count: { status: true },
      }),
      db.userLibrary.count({ where: { userId, isFavorite: true } }),
      db.readingProgress.count({ where: { userId } }),
    ]);

    const statusMap: Record<string, number> = {
      READING: 0,
      COMPLETED: 0,
      PLAN_TO_READ: 0,
      ON_HOLD: 0,
      DROPPED: 0,
    };

    let totalSaved = 0;
    for (const item of libraryStatusCounts) {
      statusMap[item.status] = item._count.status;
      totalSaved += item._count.status;
    }

    const stats: UserStats = {
      totalBookmarks,
      totalHistory,
      totalSaved,
      reading: statusMap.READING,
      completed: statusMap.COMPLETED,
      planToRead: statusMap.PLAN_TO_READ,
      onHold: statusMap.ON_HOLD,
      dropped: statusMap.DROPPED,
      favorites: favoritesCount,
      chaptersReadCount: chaptersProgressCount || totalHistory,
    };

    return {
      ...user,
      stats,
    };
  }

  /**
   * Updates basic user profile attributes: username, email, bio, avatarUrl.
   */
  static async updateUserProfile(
    userId: string,
    data: {
      username?: string;
      email?: string;
      bio?: string;
      avatarUrl?: string;
    }
  ) {
    const db = await getPrisma();

    const existingUser = await db.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      throw new Error("USER_NOT_FOUND: User does not exist");
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (data.username && data.username.trim() !== existingUser.username) {
      const cleanUsername = data.username.trim();
      if (cleanUsername.length < 3 || cleanUsername.length > 30) {
        throw new Error("INVALID_USERNAME: Username must be between 3 and 30 characters");
      }
      const duplicateUsername = await db.user.findUnique({
        where: { username: cleanUsername },
      });
      if (duplicateUsername && duplicateUsername.id !== userId) {
        throw new Error("USERNAME_TAKEN: That username is already in use");
      }
      updateData.username = cleanUsername;
    }

    if (data.email && data.email.trim() !== existingUser.email) {
      const cleanEmail = data.email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        throw new Error("INVALID_EMAIL: Please enter a valid email address");
      }
      const duplicateEmail = await db.user.findUnique({
        where: { email: cleanEmail },
      });
      if (duplicateEmail && duplicateEmail.id !== userId) {
        throw new Error("EMAIL_TAKEN: That email is already registered");
      }
      updateData.email = cleanEmail;
    }

    if (data.bio !== undefined) {
      updateData.bio = data.bio ? data.bio.trim().slice(0, 500) : null;
    }

    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl ? data.avatarUrl.trim() : null;
    }

    return db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        bio: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Securely changes user password after verifying existing password.
   */
  static async changeUserPassword(userId: string, currentPass: string, newPass: string) {
    const db = await getPrisma();

    if (!newPass || newPass.length < 8) {
      throw new Error("PASSWORD_TOO_SHORT: New password must be at least 8 characters long");
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND: User does not exist");
    }

    const isValid = await AuthService.verifyPassword(currentPass, user.passwordHash);
    if (!isValid) {
      throw new Error("INVALID_PASSWORD: Current password does not match");
    }

    const newHash = await AuthService.hashPassword(newPass);

    await db.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { success: true };
  }

  /**
   * Retrieves user bookmarks with rich chapter tracking, search, sorting, and pagination.
   */
  static async getUserBookmarks(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: "recent" | "updated" | "title";
    }
  ) {
    const db = await getPrisma();
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(200, Math.max(1, options?.limit || 50));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.BookmarkWhereInput = {
      userId,
      manga: { deletedAt: null },
    };

    if (options?.search && options.search.trim()) {
      whereClause.manga = {
        deletedAt: null,
        title: { contains: options.search.trim(), mode: "insensitive" },
      };
    }

    let orderBy: Prisma.BookmarkOrderByWithRelationInput = { createdAt: "desc" };
    if (options?.sortBy === "title") {
      orderBy = { manga: { title: "asc" } };
    } else if (options?.sortBy === "updated") {
      orderBy = { manga: { updatedAt: "desc" } };
    }

    const [total, bookmarks] = await Promise.all([
      db.bookmark.count({ where: whereClause }),
      db.bookmark.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
        include: {
          manga: {
            include: {
              genres: { include: { genre: true } },
              chapters: {
                orderBy: { chapterNumber: "desc" },
                take: 1,
                select: {
                  id: true,
                  chapterNumber: true,
                  chapterTitle: true,
                  createdAt: true,
                },
              },
              _count: { select: { chapters: true } },
            },
          },
        },
      }),
    ]);

    // Fetch user reading history for these bookmarked manga to calculate progress & unread badges
    const mangaIds = bookmarks.map((b) => b.mangaId);
    const historyList = await db.readingHistory.findMany({
      where: {
        userId,
        mangaId: { in: mangaIds },
      },
      include: {
        chapter: {
          select: {
            id: true,
            chapterNumber: true,
            chapterTitle: true,
          },
        },
      },
    });

    const historyMap = new Map<string, (typeof historyList)[0]>();
    for (const h of historyList) {
      historyMap.set(h.mangaId, h);
    }

    const items = bookmarks.map((b) => {
      const latestChapter = b.manga.chapters[0] || null;
      const reading = historyMap.get(b.mangaId) || null;

      let unreadChapters = 0;
      if (latestChapter && reading?.chapter) {
        const diff = latestChapter.chapterNumber - reading.chapter.chapterNumber;
        unreadChapters = Math.max(0, Math.floor(diff));
      } else if (latestChapter && !reading) {
        unreadChapters = b.manga._count.chapters;
      }

      return {
        id: b.id,
        mangaId: b.mangaId,
        bookmarkedAt: b.createdAt,
        manga: {
          id: b.manga.id,
          title: b.manga.title,
          slug: b.manga.slug,
          coverUrl: b.manga.coverUrl,
          publicationStatus: b.manga.publicationStatus,
          contentType: b.manga.contentType,
          totalChapters: b.manga._count.chapters,
          latestChapter: latestChapter
            ? {
                id: latestChapter.id,
                chapterNumber: latestChapter.chapterNumber,
                title: latestChapter.chapterTitle,
                createdAt: latestChapter.createdAt,
              }
            : null,
          genres: b.manga.genres.map((g) => g.genre.name),
        },
        readingProgress: reading
          ? {
              chapterId: reading.chapterId,
              chapterNumber: reading.chapter.chapterNumber,
              chapterTitle: reading.chapter.chapterTitle,
              pageNumber: reading.pageNumber,
              percentRead: reading.percentRead,
              isCompleted: reading.isCompleted,
              lastReadAt: reading.lastReadAt,
            }
          : null,
        unreadChapters,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Toggles bookmark state for a manga.
   */
  static async toggleBookmark(userId: string, mangaId: string) {
    const db = await getPrisma();

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
   * Bulk reconciles guest bookmarks into user account.
   */
  static async syncBookmarks(
    userId: string,
    guestBookmarks: Array<{ mangaId: string; createdAt?: string | Date }>
  ) {
    const db = await getPrisma();

    if (!Array.isArray(guestBookmarks) || guestBookmarks.length === 0) {
      return { syncedCount: 0 };
    }

    // Filter valid mangas that exist and are not deleted
    const mangaIds = guestBookmarks.map((b) => b.mangaId).filter(Boolean);
    const validMangas = await db.manga.findMany({
      where: { id: { in: mangaIds }, deletedAt: null },
      select: { id: true },
    });
    const validSet = new Set(validMangas.map((m) => m.id));

    let syncedCount = 0;
    for (const b of guestBookmarks) {
      if (!validSet.has(b.mangaId)) continue;
      const date = b.createdAt ? new Date(b.createdAt) : new Date();

      await db.bookmark.upsert({
        where: {
          userId_mangaId: { userId, mangaId: b.mangaId },
        },
        update: {},
        create: {
          userId,
          mangaId: b.mangaId,
          createdAt: isNaN(date.getTime()) ? new Date() : date,
        },
      });
      syncedCount++;
    }

    return { syncedCount };
  }

  /**
   * Removes a bookmark directly.
   */
  static async removeBookmark(userId: string, mangaId: string) {
    const db = await getPrisma();
    await db.bookmark.deleteMany({
      where: { userId, mangaId },
    });
    return { success: true };
  }

  /**
   * Retrieves reading history with search, pagination, and sorting.
   */
  static async getUserHistory(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      search?: string;
    }
  ) {
    const db = await getPrisma();
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(200, Math.max(1, options?.limit || 50));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ReadingHistoryWhereInput = {
      userId,
      manga: { deletedAt: null },
    };

    if (options?.search && options.search.trim()) {
      whereClause.manga = {
        deletedAt: null,
        title: { contains: options.search.trim(), mode: "insensitive" },
      };
    }

    const [total, history] = await Promise.all([
      db.readingHistory.count({ where: whereClause }),
      db.readingHistory.findMany({
        where: whereClause,
        orderBy: { lastReadAt: "desc" },
        skip,
        take: limit,
        include: {
          manga: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverUrl: true,
              publicationStatus: true,
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
      }),
    ]);

    return {
      items: history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Deletes a single reading history entry for a manga.
   */
  static async deleteHistoryEntry(userId: string, mangaId: string) {
    const db = await getPrisma();
    await db.readingHistory.deleteMany({
      where: { userId, mangaId },
    });
    return { success: true };
  }

  /**
   * Clears the user's entire reading history.
   */
  static async clearAllHistory(userId: string) {
    const db = await getPrisma();
    await db.readingHistory.deleteMany({
      where: { userId },
    });
    return { success: true };
  }

  /**
   * Bulk merges guest reading history into user account.
   */
  static async syncHistory(
    userId: string,
    items: Array<{
      mangaId: string;
      chapterId: string;
      pageNumber: number;
      percentRead?: number;
      isCompleted?: boolean;
      lastReadAt?: string | Date;
    }>
  ) {
    const db = await getPrisma();

    if (!Array.isArray(items) || items.length === 0) {
      return { syncedCount: 0 };
    }

    let syncedCount = 0;
    for (const item of items) {
      if (!item.mangaId || !item.chapterId) continue;
      const date = item.lastReadAt ? new Date(item.lastReadAt) : new Date();

      await db.readingHistory.upsert({
        where: {
          userId_mangaId: { userId, mangaId: item.mangaId },
        },
        update: {
          chapterId: item.chapterId,
          pageNumber: item.pageNumber || 1,
          percentRead: item.percentRead || 0,
          isCompleted: item.isCompleted || false,
          lastReadAt: isNaN(date.getTime()) ? new Date() : date,
        },
        create: {
          userId,
          mangaId: item.mangaId,
          chapterId: item.chapterId,
          pageNumber: item.pageNumber || 1,
          percentRead: item.percentRead || 0,
          isCompleted: item.isCompleted || false,
          lastReadAt: isNaN(date.getTime()) ? new Date() : date,
        },
      });
      syncedCount++;
    }

    return { syncedCount };
  }

  /**
   * Exports full user data (bookmarks, library, history, preferences) as clean JSON backup.
   */
  static async exportUserData(userId: string) {
    const db = await getPrisma();

    const [user, bookmarks, library, history, preferences] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
        },
      }),
      db.bookmark.findMany({
        where: { userId },
        include: {
          manga: { select: { id: true, title: true, slug: true } },
        },
      }),
      db.userLibrary.findMany({
        where: { userId },
        include: {
          manga: { select: { id: true, title: true, slug: true } },
        },
      }),
      db.readingHistory.findMany({
        where: { userId },
        include: {
          manga: { select: { id: true, title: true, slug: true } },
          chapter: { select: { id: true, chapterNumber: true, chapterTitle: true } },
        },
      }),
      db.readerPreference.findUnique({
        where: { userId },
      }),
    ]);

    return {
      version: "1.0",
      exportDate: new Date().toISOString(),
      user,
      preferences,
      bookmarks: bookmarks.map((b) => ({
        mangaId: b.mangaId,
        mangaSlug: b.manga.slug,
        mangaTitle: b.manga.title,
        createdAt: b.createdAt.toISOString(),
      })),
      library: library.map((l) => ({
        mangaId: l.mangaId,
        mangaSlug: l.manga.slug,
        mangaTitle: l.manga.title,
        status: l.status,
        score: l.score,
        isFavorite: l.isFavorite,
        notes: l.notes,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      })),
      history: history.map((h) => ({
        mangaId: h.mangaId,
        mangaSlug: h.manga.slug,
        mangaTitle: h.manga.title,
        chapterId: h.chapterId,
        chapterNumber: h.chapter.chapterNumber,
        pageNumber: h.pageNumber,
        percentRead: h.percentRead,
        isCompleted: h.isCompleted,
        lastReadAt: h.lastReadAt.toISOString(),
      })),
    };
  }

  /**
   * Imports and restores user data from a valid backup payload.
   */
  static async importUserData(
    userId: string,
    backup: {
      bookmarks?: Array<{ mangaId?: string; mangaSlug?: string; createdAt?: string | Date }>;
      library?: Array<{
        mangaId?: string;
        mangaSlug?: string;
        status?: LibraryStatus;
        score?: number | null;
        isFavorite?: boolean;
        notes?: string | null;
        createdAt?: string | Date;
      }>;
      history?: Array<{
        mangaId?: string;
        mangaSlug?: string;
        chapterId?: string;
        pageNumber?: number;
        percentRead?: number;
        isCompleted?: boolean;
        lastReadAt?: string | Date;
      }>;
      preferences?: any;
    }
  ) {
    const db = await getPrisma();
    let importedBookmarks = 0;
    let importedLibrary = 0;
    let importedHistory = 0;

    // Helper map for slug resolution if mangaId is missing or changed
    const allMangas = await db.manga.findMany({
      where: { deletedAt: null },
      select: { id: true, slug: true },
    });
    const idSet = new Set(allMangas.map((m) => m.id));
    const slugMap = new Map(allMangas.map((m) => [m.slug, m.id]));

    const resolveMangaId = (item: { mangaId?: string; mangaSlug?: string }): string | null => {
      if (item.mangaId && idSet.has(item.mangaId)) return item.mangaId;
      if (item.mangaSlug && slugMap.has(item.mangaSlug)) return slugMap.get(item.mangaSlug)!;
      return null;
    };

    // 1. Restore Bookmarks
    if (Array.isArray(backup.bookmarks)) {
      for (const b of backup.bookmarks) {
        const mangaId = resolveMangaId(b);
        if (!mangaId) continue;
        await db.bookmark.upsert({
          where: { userId_mangaId: { userId, mangaId } },
          update: {},
          create: {
            userId,
            mangaId,
            createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
          },
        });
        importedBookmarks++;
      }
    }

    // 2. Restore Library
    if (Array.isArray(backup.library)) {
      for (const l of backup.library) {
        const mangaId = resolveMangaId(l);
        if (!mangaId) continue;
        await db.userLibrary.upsert({
          where: { userId_mangaId: { userId, mangaId } },
          update: {
            status: l.status || "PLAN_TO_READ",
            score: l.score,
            isFavorite: Boolean(l.isFavorite),
            notes: l.notes,
          },
          create: {
            userId,
            mangaId,
            status: l.status || "PLAN_TO_READ",
            score: l.score,
            isFavorite: Boolean(l.isFavorite),
            notes: l.notes,
          },
        });
        importedLibrary++;
      }
    }

    // 3. Restore History
    if (Array.isArray(backup.history)) {
      for (const h of backup.history) {
        const mangaId = resolveMangaId(h);
        if (!mangaId) continue;

        let chapterId = h.chapterId;
        if (!chapterId) {
          const firstChapter = await db.chapter.findFirst({
            where: { mangaId },
            orderBy: { chapterNumber: "asc" },
            select: { id: true },
          });
          if (firstChapter) chapterId = firstChapter.id;
        }

        if (!chapterId) continue;

        await db.readingHistory.upsert({
          where: { userId_mangaId: { userId, mangaId } },
          update: {
            chapterId,
            pageNumber: h.pageNumber || 1,
            percentRead: h.percentRead || 0,
            isCompleted: Boolean(h.isCompleted),
            lastReadAt: h.lastReadAt ? new Date(h.lastReadAt) : new Date(),
          },
          create: {
            userId,
            mangaId,
            chapterId,
            pageNumber: h.pageNumber || 1,
            percentRead: h.percentRead || 0,
            isCompleted: Boolean(h.isCompleted),
            lastReadAt: h.lastReadAt ? new Date(h.lastReadAt) : new Date(),
          },
        });
        importedHistory++;
      }
    }

    // 4. Restore Preferences
    if (backup.preferences && typeof backup.preferences === "object") {
      const { id, userId: _, ...prefFields } = backup.preferences;
      await db.readerPreference.upsert({
        where: { userId },
        update: prefFields,
        create: { userId, ...prefFields },
      });
    }

    return {
      success: true,
      importedBookmarks,
      importedLibrary,
      importedHistory,
    };
  }
}
